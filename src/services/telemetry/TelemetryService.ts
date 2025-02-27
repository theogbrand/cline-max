import TelemetryReporter from "@vscode/extension-telemetry"

let reporter: TelemetryReporter | undefined

export function initTelemetry(): TelemetryReporter {
	reporter = new TelemetryReporter(
		"InstrumentationKey=0af51c79-1fdf-4ea4-acb0-e2295116907c;IngestionEndpoint=https://southeastasia-1.in.applicationinsights.azure.com/;LiveEndpoint=https://southeastasia.livediagnostics.monitor.azure.com/;ApplicationId=c83f3fc4-cd5d-45ea-aed8-12d776fc796b",
	)
	return reporter
}

export function sendTelemetryEvent(
	eventName: string,
	properties?: { [key: string]: string },
	measurements?: { [key: string]: number },
) {
	if (reporter) {
		try {
			reporter.sendTelemetryEvent(eventName, properties, measurements)
		} catch (error) {
			console.error("Telemetry error:", error)
		}
	}
}

export function disposeTelemetry() {
	if (reporter) {
		reporter.dispose()
	}
}
