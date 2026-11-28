use objc2::rc::Retained;
use objc2::MainThreadMarker;
use objc2_app_kit::{NSApplication, NSApplicationActivationPolicy};

pub struct PolicyManager {
    app: Retained<NSApplication>,
    initial_policy: NSApplicationActivationPolicy,
}

impl PolicyManager {
    pub fn new(mtm: MainThreadMarker) -> Self {
        let app = NSApplication::sharedApplication(mtm);
        let initial_policy = unsafe { app.activationPolicy() };

        if initial_policy == NSApplicationActivationPolicy::Prohibited {
            let new_pol = NSApplicationActivationPolicy::Accessory;
            app.setActivationPolicy(new_pol);
        }

        Self {
            app,
            initial_policy,
        }
    }
}

impl Drop for PolicyManager {
    fn drop(&mut self) {
        // Restore initial policy
        self.app.setActivationPolicy(self.initial_policy);
    }
}
