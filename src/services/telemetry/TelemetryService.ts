import TelemetryReporter from "@vscode/extension-telemetry"

let reporter: TelemetryReporter | undefined

export function initTelemetry(): TelemetryReporter {
    reporter = new TelemetryReporter("InstrumentationKey=3ccb5d83-f371-4d34-9a1d-9d661a8d59a4;IngestionEndpoint=https://southeastasia-1.in.applicationinsights.azure.com/;LiveEndpoint=https://southeastasia.livediagnostics.monitor.azure.com/;ApplicationId=cc6d86ab-27c1-4f8d-98cc-393fcfb20aed")
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