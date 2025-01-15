import React, { useState, useEffect, useCallback } from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import styled from "styled-components"
import { vscode } from "../../utils/vscode"
import MarkdownBlock from "../common/MarkdownBlock"

export type Message = {
	text: string
	role: "user" | "assistant"
	timestamp?: number
	partial?: boolean
}

interface PlanEditorProps {
	plan: string
	onUpdate: (plan: string) => void
	readonly?: boolean
	messageHistory: Message[]
	onMessageHistoryUpdate: (updater: (prevMessages: Message[]) => Message[]) => void
}

const PlanEditor: React.FC<PlanEditorProps> = ({
	plan,
	onUpdate,
	readonly,
	messageHistory,
	onMessageHistoryUpdate
}) => {
	const [localPlan, setLocalPlan] = useState(plan)
	const [isGenerating, setIsGenerating] = useState(false)

	useEffect(() => {
		if (!localPlan) {
			setLocalPlan(plan)
		}
	}, [plan, localPlan])

	useEffect(() => {
		const handleMessage = (event: MessageEvent<{ type: string; text?: string; partial?: boolean }>) => {
			const message = event.data
			
			if (message.type === "planResponse") {
				onMessageHistoryUpdate((prevMessages) => {
					const lastMessage = prevMessages[prevMessages.length - 1]
					
					// If we have a last message that's from assistant, update it
					if (lastMessage?.role === "assistant") {
						const updatedMessages = [...prevMessages]
						updatedMessages[prevMessages.length - 1] = {
							...lastMessage,
							text: message.text || "",
							partial: message.partial
						}
						return updatedMessages
					}
					
					// Otherwise create a new message
					return [...prevMessages, {
						text: message.text || "",
						role: "assistant",
						timestamp: Date.now(),
						partial: message.partial
					}]
				})
				
				// Only set generating to false when we get the final message
				if (!message.partial) {
					setIsGenerating(false)
				}
			}
		}
		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	const handleOverviewChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const newValue = e.target.value
		setLocalPlan(newValue)
		onUpdate(newValue)
	}

	const handleSubmit = useCallback(() => {
		if (!localPlan.trim()) return
		setIsGenerating(true)
		
		// Add user message to history before sending
		onMessageHistoryUpdate((prevMessages: Message[]) => [
			...prevMessages,
			{
				text: localPlan.trim(),
				role: "user",
				timestamp: Date.now(),
				partial: false
			},
		])

		// Consolidate message history into a single text block
		const consolidatedText = [
			// Add current plan as the latest user message
			...messageHistory.map(msg =>
				`${msg.role.toUpperCase()}: ${msg.text}`
			),
			// Add the current plan text
			`USER: ${localPlan.trim()}`
		].join("\n\n");

		// Format as a single text block that matches Cline's expected format
		vscode.postMessage({
			type: "generatePlan",
			text: JSON.stringify({
				messages: [
					{
						type: "text",
						text: `<task>\n${consolidatedText}\n</task>`
					}
				]
			})
		})
	}, [localPlan, messageHistory])

	return (
		<Container>
			<Header>
				<h2>Start Planning</h2>
			</Header>

			{messageHistory.length > 0 && (
				<ResponseSection>
					<ResponseHeader>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
							<h3>Plan Discussion</h3>
							<VSCodeButton
								appearance="secondary"
								onClick={() => onMessageHistoryUpdate(() => [])}
							>
								Clear History
							</VSCodeButton>
						</div>
					</ResponseHeader>
					<ResponseContent>
						{messageHistory.map((msg, idx) => (
							<div key={idx} style={{
								marginBottom: 16,
								opacity: msg.role === "user" ? 0.8 : 1,
								position: 'relative',
								paddingRight: msg.partial && msg.role === "assistant" ? '12px' : undefined
							}}>
								<div style={{
									fontWeight: 600,
									fontSize: "0.9em",
									marginBottom: 4,
									color: "var(--vscode-descriptionForeground)",
									display: 'flex',
									alignItems: 'center',
									gap: '8px'
								}}>
									{msg.role === "user" ? "You:" : (
										<>
											Assistant
											{msg.partial && (
												<span style={{
													color: 'var(--vscode-errorForeground)',
													fontSize: '0.8em',
													opacity: 0.9
												}}>
													(streaming...)
												</span>
											)}
										</>
									)}
								</div>
								<div style={{ position: 'relative' }}>
									<MarkdownBlock markdown={msg.text} />
									{msg.partial && msg.role === "assistant" && (
										<div
											style={{
												position: 'absolute',
												right: '-12px',
												top: 0,
												bottom: 0,
												width: '4px',
												backgroundColor: 'var(--vscode-errorForeground)',
												animation: 'blink 1s step-end infinite'
											}}
										/>
									)}
								</div>
							</div>
						))}
					</ResponseContent>
				</ResponseSection>
			)}

			<Section>
				<label>Planner</label>
				<StyledTextArea
					value={localPlan}
					onChange={handleOverviewChange}
					rows={8}
					readOnly={readonly || isGenerating}
					placeholder={messageHistory.length > 0 ? "Continue the discussion..." : "Draft your plan here"}
				/>
			</Section>

			{!readonly && (
				<Actions>
					<VSCodeButton appearance="primary" onClick={handleSubmit} disabled={isGenerating || !localPlan.trim()}>
						{isGenerating ? "Generating..." : messageHistory.length > 0 ? "Continue Plan" : "Generate Plan"}
					</VSCodeButton>
				</Actions>
			)}
		</Container>
	)
}

const Container = styled.div`
	padding: 16px;
	display: flex;
	flex-direction: column;
	gap: 16px;
	height: 100vh;
	box-sizing: border-box;

	@keyframes blink {
		0%, 100% { border-color: transparent; }
		50% { border-color: var(--vscode-editor-foreground); }
	}
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

const ResponseSection = styled.div`
	border: 1px solid var(--vscode-input-border);
	border-radius: 4px;
	overflow: hidden;
	margin-bottom: 16px;
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
`

const ResponseHeader = styled.div`
	background: var(--vscode-editor-background);
	padding: 8px 12px;
	border-bottom: 1px solid var(--vscode-input-border);

	h3 {
		margin: 0;
		font-size: 14px;
		color: var(--vscode-editor-foreground);
	}
`

const ResponseContent = styled.div`
	padding: 12px;
	background: var(--vscode-editor-background);
	color: var(--vscode-editor-foreground);
	flex: 1;
	overflow-y: auto;
	overflow-x: hidden;
`

export default PlanEditor
