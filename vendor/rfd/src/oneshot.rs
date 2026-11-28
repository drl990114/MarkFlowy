use std::fmt;
use std::future::Future;
use std::pin::Pin;
use std::sync::{
    atomic::{AtomicBool, Ordering::SeqCst},
    Arc, Mutex,
};
use std::task::{Context, Poll, Waker};

#[must_use = "futures do nothing unless you `.await` or poll them"]
pub struct Receiver<T> {
    inner: Arc<Inner<T>>,
}

pub struct Sender<T> {
    inner: Arc<Inner<T>>,
}

// The channels do not ever project Pin to the inner T
impl<T> Unpin for Receiver<T> {}
impl<T> Unpin for Sender<T> {}

/// Internal state of the `Receiver`/`Sender` pair above. This is all used as
/// the internal synchronization between the two for send/recv operations.
struct Inner<T> {
    /// Indicates whether this oneshot is complete yet. This is filled in both
    /// by `Sender::drop` and by `Receiver::drop`, and both sides interpret it
    /// appropriately.
    ///
    /// For `Receiver`, if this is `true`, then it's guaranteed that `data` is
    /// unlocked and ready to be inspected.
    ///
    /// For `Sender` if this is `true` then the oneshot has gone away and it
    /// can return ready from `poll_canceled`.
    complete: AtomicBool,

    /// The actual data being transferred as part of this `Receiver`. This is
    /// filled in by `Sender::complete` and read by `Receiver::poll`.
    ///
    /// Note that this is protected by `Lock`, but it is in theory safe to
    /// replace with an `UnsafeCell` as it's actually protected by `complete`
    /// above. I wouldn't recommend doing this, however, unless someone is
    /// supremely confident in the various atomic orderings here and there.
    data: Mutex<Option<T>>,

    /// Field to store the task which is blocked in `Receiver::poll`.
    ///
    /// This is filled in when a oneshot is polled but not ready yet. Note that
    /// the `Lock` here, unlike in `data` above, is important to resolve races.
    /// Both the `Receiver` and the `Sender` halves understand that if they
    /// can't acquire the lock then some important interference is happening.
    rx_task: Mutex<Option<Waker>>,

    /// Like `rx_task` above, except for the task blocked in
    /// `Sender::poll_canceled`. Additionally, `Lock` cannot be `UnsafeCell`.
    tx_task: Mutex<Option<Waker>>,
}

pub fn channel<T>() -> (Sender<T>, Receiver<T>) {
    let inner = Arc::new(Inner::new());
    let receiver = Receiver {
        inner: inner.clone(),
    };
    let sender = Sender { inner };
    (sender, receiver)
}

impl<T> Inner<T> {
    fn new() -> Self {
        Self {
            complete: AtomicBool::new(false),
            data: Mutex::new(None),
            rx_task: Mutex::new(None),
            tx_task: Mutex::new(None),
        }
    }

    fn send(&self, t: T) -> Result<(), T> {
        if self.complete.load(SeqCst) {
            return Err(t);
        }

        // Note that this lock acquisition may fail if the receiver
        // is closed and sets the `complete` flag to `true`, whereupon
        // the receiver may call `poll()`.
        if let Ok(mut slot) = self.data.try_lock() {
            assert!(slot.is_none());
            *slot = Some(t);
            drop(slot);

            // If the receiver called `close()` between the check at the
            // start of the function, and the lock being released, then
            // the receiver may not be around to receive it, so try to
            // pull it back out.
            if self.complete.load(SeqCst) {
                // If lock acquisition fails, then receiver is actually
                // receiving it, so we're good.
                if let Ok(mut slot) = self.data.try_lock() {
                    if let Some(t) = slot.take() {
                        return Err(t);
                    }
                }
            }
            Ok(())
        } else {
            // Must have been closed
            Err(t)
        }
    }

    fn drop_tx(&self) {
        // Flag that we're a completed `Sender` and try to wake up a receiver.
        // Whether or not we actually stored any data will get picked up and
        // translated to either an item or cancellation.
        //
        // Note that if we fail to acquire the `rx_task` lock then that means
        // we're in one of two situations:
        //
        // 1. The receiver is trying to block in `poll`
        // 2. The receiver is being dropped
        //
        // In the first case it'll check the `complete` flag after it's done
        // blocking to see if it succeeded. In the latter case we don't need to
        // wake up anyone anyway. So in both cases it's ok to ignore the `None`
        // case of `try_lock` and bail out.
        //
        // The first case crucially depends on `Lock` using `SeqCst` ordering
        // under the hood. If it instead used `Release` / `Acquire` ordering,
        // then it would not necessarily synchronize with `inner.complete`
        // and deadlock might be possible, as was observed in
        // https://github.com/rust-lang/futures-rs/pull/219.
        self.complete.store(true, SeqCst);

        if let Ok(mut slot) = self.rx_task.try_lock() {
            if let Some(task) = slot.take() {
                drop(slot);
                task.wake();
            }
        }

        // If we registered a task for cancel notification drop it to reduce
        // spurious wakeups
        if let Ok(mut slot) = self.tx_task.try_lock() {
            drop(slot.take());
        }
    }

    fn recv(&self, cx: &mut Context<'_>) -> Poll<Result<T, Canceled>> {
        // Check to see if some data has arrived. If it hasn't then we need to
        // block our task.
        //
        // Note that the acquisition of the `rx_task` lock might fail below, but
        // the only situation where this can happen is during `Sender::drop`
        // when we are indeed completed already. If that's happening then we
        // know we're completed so keep going.
        let done = if self.complete.load(SeqCst) {
            true
        } else {
            let task = cx.waker().clone();
            match self.rx_task.try_lock() {
                Ok(mut slot) => {
                    *slot = Some(task);
                    false
                }
                Err(_) => true,
            }
        };

        // If we're `done` via one of the paths above, then look at the data and
        // figure out what the answer is. If, however, we stored `rx_task`
        // successfully above we need to check again if we're completed in case
        // a message was sent while `rx_task` was locked and couldn't notify us
        // otherwise.
        //
        // If we're not done, and we're not complete, though, then we've
        // successfully blocked our task and we return `Pending`.
        if done || self.complete.load(SeqCst) {
            // If taking the lock fails, the sender will realise that the we're
            // `done` when it checks the `complete` flag on the way out, and
            // will treat the send as a failure.
            if let Ok(mut slot) = self.data.try_lock() {
                if let Some(data) = slot.take() {
                    return Poll::Ready(Ok(data));
                }
            }
            Poll::Ready(Err(Canceled))
        } else {
            Poll::Pending
        }
    }

    fn drop_rx(&self) {
        // Indicate to the `Sender` that we're done, so any future calls to
        // `poll_canceled` are weeded out.
        self.complete.store(true, SeqCst);

        // If we've blocked a task then there's no need for it to stick around,
        // so we need to drop it. If this lock acquisition fails, though, then
        // it's just because our `Sender` is trying to take the task, so we
        // let them take care of that.
        if let Ok(mut slot) = self.rx_task.try_lock() {
            let task = slot.take();
            drop(slot);
            drop(task);
        }

        // Finally, if our `Sender` wants to get notified of us going away, it
        // would have stored something in `tx_task`. Here we try to peel that
        // out and unpark it.
        //
        // Note that the `try_lock` here may fail, but only if the `Sender` is
        // in the process of filling in the task. If that happens then we
        // already flagged `complete` and they'll pick that up above.
        if let Ok(mut handle) = self.tx_task.try_lock() {
            if let Some(task) = handle.take() {
                drop(handle);
                task.wake()
            }
        }
    }
}

impl<T> Sender<T> {
    pub fn send(self, t: T) -> Result<(), T> {
        self.inner.send(t)
    }
}

impl<T> Drop for Sender<T> {
    fn drop(&mut self) {
        self.inner.drop_tx()
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Canceled;

impl fmt::Display for Canceled {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "oneshot canceled")
    }
}

impl std::error::Error for Canceled {}

impl<T> Future for Receiver<T> {
    type Output = Result<T, Canceled>;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Result<T, Canceled>> {
        self.inner.recv(cx)
    }
}

impl<T> Drop for Receiver<T> {
    fn drop(&mut self) {
        self.inner.drop_rx()
    }
}
