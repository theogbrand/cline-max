import TelemetryReporter from "@vscode/extension-telemetry"

let reporter: TelemetryReporter | undefined

export function initTelemetry(key: string): TelemetryReporter {
    reporter = new TelemetryReporter(key)
    return reporter
}

export function sendTelemetryEvent(
    eventName: string, 
    properties?: { [key: string]: string }, 
    measurements?: { [key: string]: number }
) {
    if (reporter) {
        try {
            reporter.sendTelemetryEvent(eventName, properties, measurements)
        } catch (error) {
            console.error('Telemetry error:', error)
        }
    }
}

export function disposeTelemetry() {
    if (reporter) {
        reporter.dispose()
    }
} 