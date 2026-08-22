use std::sync::Arc;

use tokio::sync::Semaphore;

#[derive(Debug, thiserror::Error)]
pub(crate) enum StartupBlockingError {
    #[error("startup blocking I/O limiter was closed")]
    LimiterClosed,
    #[error("startup blocking I/O task failed to join: {0}")]
    Join(#[from] tokio::task::JoinError),
}

lazy_static::lazy_static! {
    static ref STARTUP_BLOCKING_LIMITER: Arc<Semaphore> = {
        let parallelism = startup_blocking_parallelism();
        tracing::debug!(parallelism, "Startup blocking I/O limiter initialized");
        Arc::new(Semaphore::new(parallelism))
    };
}

fn startup_blocking_parallelism() -> usize {
    startup_blocking_parallelism_for(
        std::thread::available_parallelism()
            .map(usize::from)
            .unwrap_or(1),
    )
}

fn startup_blocking_parallelism_for(available_parallelism: usize) -> usize {
    available_parallelism.saturating_sub(1).clamp(1, 2)
}

/// Runs filesystem work on Tokio's blocking pool while preserving capacity for
/// the WebView and async runtime during startup.
///
/// The owned permit lives inside the blocking closure. It is therefore released
/// even if the caller is cancelled after the task starts, or if the task panics.
pub(crate) async fn run<F, T>(work: F) -> Result<T, StartupBlockingError>
where
    F: FnOnce() -> T + Send + 'static,
    T: Send + 'static,
{
    let permit = Arc::clone(&STARTUP_BLOCKING_LIMITER)
        .acquire_owned()
        .await
        .map_err(|_| StartupBlockingError::LimiterClosed)?;

    tokio::task::spawn_blocking(move || {
        let _permit = permit;
        work()
    })
    .await
    .map_err(StartupBlockingError::from)
}

#[cfg(test)]
mod tests {
    use super::{run, startup_blocking_parallelism_for};

    #[test]
    fn blocking_parallelism_preserves_runtime_capacity() {
        assert_eq!(startup_blocking_parallelism_for(0), 1);
        assert_eq!(startup_blocking_parallelism_for(1), 1);
        assert_eq!(startup_blocking_parallelism_for(2), 1);
        assert_eq!(startup_blocking_parallelism_for(3), 2);
        assert_eq!(startup_blocking_parallelism_for(32), 2);
    }

    #[tokio::test]
    async fn blocking_work_returns_its_value() {
        assert_eq!(run(|| 42).await.expect("blocking task should join"), 42);
    }
}
