use std::pin::Pin;
use std::sync::{Arc, Mutex, TryLockError};

use std::task::{Context, Poll, Waker};

struct FutureState<R> {
    waker: Mutex<Option<Waker>>,
    data: Mutex<Option<R>>,
}

pub struct ThreadFuture<R> {
    state: Arc<FutureState<R>>,
}

unsafe impl<R> Send for ThreadFuture<R> {}

impl<R: Send + 'static> ThreadFuture<R> {
    pub fn new<F: FnOnce(&mut Option<R>) + Send + 'static>(f: F) -> Self {
        let state = Arc::new(FutureState {
            waker: Mutex::new(None),
            data: Mutex::new(None),
        });

        {
            let state = state.clone();
            std::thread::spawn(move || {
                f(&mut state.data.lock().unwrap());

                if let Some(waker) = state.waker.lock().unwrap().take() {
                    waker.wake();
                }
            });
        }

        Self { state }
    }
}

impl<R> std::future::Future for ThreadFuture<R> {
    type Output = R;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        let state = &self.state;
        let data = state.data.try_lock();

        match data {
            Ok(mut data) => match data.take() {
                Some(data) => Poll::Ready(data),
                None => {
                    *state.waker.lock().unwrap() = Some(cx.waker().clone());
                    Poll::Pending
                }
            },
            Err(TryLockError::Poisoned(err)) => {
                panic!("{}", err);
            }
            Err(TryLockError::WouldBlock) => {
                *state.waker.lock().unwrap() = Some(cx.waker().clone());
                Poll::Pending
            }
        }
    }
}
