use std::{
    io,
    pin::Pin,
    sync::{Arc, Mutex},
    task::{Context, Poll, Waker},
};

struct State {
    waker: Option<Waker>,
    data: Option<io::Result<std::process::Output>>,
}

pub struct AsyncCommand {
    state: Arc<Mutex<State>>,
}

impl AsyncCommand {
    pub fn spawn(mut command: std::process::Command) -> Self {
        let state = Arc::new(Mutex::new(State {
            waker: None,
            data: None,
        }));

        std::thread::spawn({
            let state = state.clone();
            move || {
                let output = command.output();

                let mut state = state.lock().unwrap();
                state.data = Some(output);

                if let Some(waker) = state.waker.take() {
                    waker.wake();
                }
            }
        });

        Self { state }
    }
}

impl std::future::Future for AsyncCommand {
    type Output = io::Result<std::process::Output>;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        let mut state = self.state.lock().unwrap();

        if state.data.is_some() {
            Poll::Ready(state.data.take().unwrap())
        } else {
            state.waker = Some(cx.waker().clone());
            Poll::Pending
        }
    }
}
