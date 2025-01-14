import React, { useState, useEffect } from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import styled from "styled-components"
import { vscode } from "../../utils/vscode"
import { ClineMessage } from "../../../../src/shared/ExtensionMessage"

interface PlanEditorProps {
	plan: string
	onUpdate: (plan: string) => void
	readonly?: boolean
	messages?: ClineMessage[]
}

const PlanEditor: React.FC<PlanEditorProps> = ({ plan, onUpdate, readonly, messages }) => {
	const [localPlan, setLocalPlan] = useState(plan)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [streamingResponse, setStreamingResponse] = useState("")

	useEffect(() => {
		setLocalPlan(plan)
	}, [plan])

	// Track submission state based on messages
	useEffect(() => {
		if (!messages?.length) return

		const latestMessage = messages[messages.length - 1]
		
		// Start submission
		if (latestMessage?.type === "say" && latestMessage.say === "api_req_started") {
			setIsSubmitting(true)
			setStreamingResponse("")
			// Check if this is a completion/cancellation of a previous request
			if (latestMessage.text) {
				try {
					const info = JSON.parse(latestMessage.text)
					if (info.cancelReason || info.cost !== undefined) {
						setIsSubmitting(false)
					}
				} catch (error) {
					console.error("Failed to parse API request info:", error)
				}
			}
		}
		// Handle streaming text
		else if (latestMessage?.type === "say" && latestMessage.say === "text") {
			setStreamingResponse(prev => prev + (latestMessage.text || ""))
		}
		// End submission
		else if (latestMessage?.type === "say" && (latestMessage.say === "completion_result" || latestMessage.say === "error")) {
			setIsSubmitting(false)
		}
	}, [messages])

	const handleOverviewChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const newValue = e.target.value
		setLocalPlan(newValue)
		onUpdate(newValue)
	}

	const handleSubmit = () => {
		setIsSubmitting(true)
		setStreamingResponse("")
		
		vscode.postMessage({
			type: "newTask",
			text: localPlan
		})
	}

	return (
		<Container>
			<Header>
				<h2>Start Planning</h2>
				{isSubmitting && <StatusIndicator>Processing...</StatusIndicator>}
			</Header>

			<Section>
				<label>Plan</label>
				<StyledTextArea
					value={localPlan}
					onChange={handleOverviewChange}
					rows={8}
					readOnly={readonly || isSubmitting}
					placeholder="Start writing plan..."
				/>
			</Section>

			{!readonly && (
				<Actions>
					<VSCodeButton 
						appearance="primary" 
						onClick={handleSubmit}
						disabled={isSubmitting}
					>
						{isSubmitting ? "Processing..." : "Submit Plan"}
					</VSCodeButton>
				</Actions>
			)}

			{(isSubmitting || streamingResponse) && (
				<ResponseSection>
					<ResponseHeader>
						<label>O1 Response</label>
						{isSubmitting && <StreamingIndicator />}
					</ResponseHeader>
					<ResponseContent>
						{streamingResponse || "Processing your plan..."}
					</ResponseContent>
				</ResponseSection>
			)}
		</Container>
	)
}

const Container = styled.div`
	padding: 16px;
	display: flex;
	flex-direction: column;
	gap: 16px;
`

const Header = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;

	h2 {
		margin: 0;
	}

	span {
		color: var(--vscode-descriptionForeground);
		font-size: 12px;
	}
`

const Section = styled.div`
	display: flex;
	flex-direction: column;
	gap: 8px;

	label {
		color: var(--vscode-foreground);
		font-weight: 600;
	}
`

const StyledTextArea = styled.textarea`
	background-color: var(--vscode-input-background);
	border: 1px solid var(--vscode-input-border);
	border-radius: 2px;
	padding: 8px;
	font-family: var(--vscode-font-family);
	font-size: var(--vscode-editor-font-size);
	resize: vertical;
	min-height: 100px;
	width: 100%;
	box-sizing: border-box;

	&:focus {
		outline: none;
		border-color: var(--vscode-focusBorder);
	}

	&:read-only {
		opacity: 0.7;
		cursor: default;
	}

	&::placeholder {
		color: var(--vscode-input-placeholderForeground);
		opacity: 0.5;
	}

	/* Ensure text is always visible with high contrast */
	&,
	&:focus,
	&:not(:read-only) {
		color: var(--vscode-input-foreground);
		background-color: var(--vscode-input-background);
	}
`

const Actions = styled.div`
	display: flex;
	justify-content: flex-end;
	gap: 8px;
	margin-top: 8px;
`

const StatusIndicator = styled.div`
	color: var(--vscode-descriptionForeground);
	font-size: 12px;
	display: flex;
	align-items: center;
	gap: 8px;
	
	&::after {
		content: "";
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--vscode-progressBar-background);
		animation: pulse 1.5s infinite;
	}

	@keyframes pulse {
		0% {
			opacity: 0.3;
		}
		50% {
			opacity: 1;
		}
		100% {
			opacity: 0.3;
		}
	}
`

const ResponseSection = styled(Section)`
	margin-top: 16px;
	border: 1px solid var(--vscode-input-border);
	border-radius: 2px;
	padding: 12px;
`

const ResponseHeader = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 8px;
`

const StreamingIndicator = styled.div`
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: var(--vscode-progressBar-background);
	animation: pulse 1.5s infinite;
`

const ResponseContent = styled.div`
	font-family: var(--vscode-editor-font-family);
	font-size: var(--vscode-editor-font-size);
	white-space: pre-wrap;
	background: var(--vscode-input-background);
	padding: 8px;
	border-radius: 2px;
	border: 1px solid var(--vscode-input-border);
	color: var(--vscode-input-foreground);
`

export default PlanEditor
