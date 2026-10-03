// Engine preparation belongs to the first editor that needs it. Shell/settings
// startup and an empty workspace must not import unused editor runtimes.
export { createStartupCoordinator as createAppStartupCoordinator } from './startupCoordinator'
