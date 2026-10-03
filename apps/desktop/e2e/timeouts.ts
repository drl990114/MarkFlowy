export const startupTimeout = 60_000
export const scenarioTimeout = 240_000

// Leave time for startup and failure diagnostics before terminating the launcher.
export const phaseTimeout = startupTimeout + scenarioTimeout + 30_000
export const hardStopTimeout = phaseTimeout + 10_000
