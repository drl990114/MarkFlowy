use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};

struct Slot {
    request_id: u64,
    active: Option<Arc<AtomicBool>>,
}

/// One watermark per window/search surface also handles cancel-before-start IPC ordering.
#[derive(Default)]
pub struct SearchSessions(Mutex<HashMap<(String, &'static str), Slot>>);

impl SearchSessions {
    pub fn begin(&self, owner: &str, scope: &'static str, request_id: u64) -> Arc<AtomicBool> {
        let mut slots = self.0.lock().unwrap();
        let key = (owner.to_owned(), scope);
        if let Some(slot) = slots.get(&key) {
            if request_id <= slot.request_id {
                return Arc::new(AtomicBool::new(true));
            }
            if let Some(active) = &slot.active {
                active.store(true, Ordering::Relaxed);
            }
        }
        let token = Arc::new(AtomicBool::new(false));
        slots.insert(
            key,
            Slot {
                request_id,
                active: Some(token.clone()),
            },
        );
        token
    }

    pub fn cancel(&self, owner: &str, scope: &'static str, request_id: u64) {
        let mut slots = self.0.lock().unwrap();
        let key = (owner.to_owned(), scope);
        if let Some(slot) = slots.get(&key) {
            if request_id < slot.request_id {
                return;
            }
            if let Some(active) = &slot.active {
                active.store(true, Ordering::Relaxed);
            }
        }
        slots.insert(
            key,
            Slot {
                request_id,
                active: None,
            },
        );
    }

    pub fn finish(&self, owner: &str, scope: &'static str, request_id: u64) {
        if let Some(slot) = self.0.lock().unwrap().get_mut(&(owner.to_owned(), scope)) {
            if slot.request_id == request_id {
                slot.active = None;
            }
        }
    }

    pub fn remove_owner(&self, owner: &str) {
        self.0.lock().unwrap().retain(|(window, _), slot| {
            if window != owner {
                return true;
            }
            if let Some(active) = &slot.active {
                active.store(true, Ordering::Relaxed);
            }
            false
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancel_before_start_does_not_resurrect_work() {
        let sessions = SearchSessions::default();
        sessions.cancel("main", "global", 12);
        assert!(sessions.begin("main", "global", 12).load(Ordering::Relaxed));
        assert!(sessions.begin("main", "global", 11).load(Ordering::Relaxed));
        assert!(!sessions.begin("main", "global", 13).load(Ordering::Relaxed));
    }

    #[test]
    fn replacement_cancels_old_work_and_ignores_late_cleanup() {
        let sessions = SearchSessions::default();
        let old = sessions.begin("main", "global", 1);
        let current = sessions.begin("main", "global", 2);
        assert!(old.load(Ordering::Relaxed));
        sessions.cancel("main", "global", 1);
        sessions.finish("main", "global", 1);
        assert!(!current.load(Ordering::Relaxed));
        sessions.cancel("main", "global", 2);
        assert!(current.load(Ordering::Relaxed));
    }

    #[test]
    fn windows_and_search_surfaces_are_independent() {
        let sessions = SearchSessions::default();
        let global = sessions.begin("main", "global", 1);
        let quick = sessions.begin("main", "quick_open", 1);
        let other = sessions.begin("other", "global", 1);
        sessions.cancel("main", "global", 1);
        assert!(global.load(Ordering::Relaxed));
        assert!(!quick.load(Ordering::Relaxed));
        assert!(!other.load(Ordering::Relaxed));
        sessions.remove_owner("main");
        assert!(quick.load(Ordering::Relaxed));
        assert!(!other.load(Ordering::Relaxed));
        assert_eq!(sessions.0.lock().unwrap().len(), 1);
    }

    #[test]
    fn finished_work_retains_only_a_watermark() {
        let sessions = SearchSessions::default();
        let token = sessions.begin("main", "global", 1);
        sessions.finish("main", "global", 1);
        assert_eq!(Arc::strong_count(&token), 1);
        assert!(sessions.begin("main", "global", 1).load(Ordering::Relaxed));
    }
}
