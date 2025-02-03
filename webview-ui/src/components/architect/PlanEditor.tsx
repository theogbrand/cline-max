import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import styled from "styled-components"
import { vscode } from "../../utils/vscode"
import MarkdownBlock from "../common/MarkdownBlock"
import { useClickAway, useWindowSize } from "react-use"
import ApiOptions, { normalizeApiConfiguration } from "../settings/ApiOptions"
import { CODE_BLOCK_BG_COLOR } from "../common/CodeBlock"
import { useExtensionState } from "../../context/ExtensionStateContext"

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

const ModelContainer = styled.div`
	position: relative;
	display: flex;
	flex: 1;
	min-width: 0;
`

const ModelButtonWrapper = styled.div`
	display: inline-flex;
	min-width: 0;
	max-width: 100%;
`

const ModelDisplayButton = styled.a<{ isActive?: boolean; disabled?: boolean }>`
	padding: 0px 0px;
	height: 20px;
	width: 100%;
	min-width: 0;
	cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};
	text-decoration: ${(props) => (props.isActive ? "underline" : "none")};
	color: ${(props) => (props.isActive ? "var(--vscode-foreground)" : "var(--vscode-descriptionForeground)")};
	display: flex;
	align-items: center;
	font-size: 10px;
	outline: none;
	user-select: none;
	opacity: ${(props) => (props.disabled ? 0.5 : 1)};
	pointer-events: ${(props) => (props.disabled ? "none" : "auto")};

	&:hover,
	&:focus {
		color: ${(props) => (props.disabled ? "var(--vscode-descriptionForeground)" : "var(--vscode-foreground)")};
		text-decoration: ${(props) => (props.disabled ? "none" : "underline")};
		outline: none;
	}

	&:active {
		color: ${(props) => (props.disabled ? "var(--vscode-descriptionForeground)" : "var(--vscode-foreground)")};
		text-decoration: ${(props) => (props.disabled ? "none" : "underline")};
		outline: none;
	}

	&:focus-visible {
		outline: none;
	}
`

const ModelButtonContent = styled.div`
	width: 100%;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`

const ModelSelectorTooltip = styled.div<ModelSelectorTooltipProps>`
	position: fixed;
	bottom: calc(100% + 9px);
	left: 15px;
	right: 15px;
	background: ${CODE_BLOCK_BG_COLOR};
	border: 1px solid var(--vscode-editorGroup-border);
	padding: 12px;
	border-radius: 3px;
	z-index: 1000;
	max-height: calc(100vh - 100px);
	overflow-y: auto;
	overscroll-behavior: contain;

	&::before {
		content: "";
		position: fixed;
		bottom: ${(props) => `calc(100vh - ${props.menuPosition}px - 2px)`};
		left: 0;
		right: 0;
		height: 8px;
	}

	&::after {
		content: "";
		position: fixed;
		bottom: ${(props) => `calc(100vh - ${props.menuPosition}px)`};
		right: ${(props) => props.arrowPosition}px;
		width: 10px;
		height: 10px;
		background: ${CODE_BLOCK_BG_COLOR};
		border-right: 1px solid var(--vscode-editorGroup-border);
		border-bottom: 1px solid var(--vscode-editorGroup-border);
		transform: rotate(45deg);
		z-index: -1;
	}
`

interface ModelSelectorTooltipProps {
	arrowPosition: number
	menuPosition: number
}

const PlanEditor: React.FC<PlanEditorProps> = ({ plan, onUpdate, readonly, messageHistory, onMessageHistoryUpdate }) => {
	const { apiConfiguration } = useExtensionState()
	const [localPlan, setLocalPlan] = useState(plan)
	const [isGenerating, setIsGenerating] = useState(false)
	const [hasInitialPlan, setHasInitialPlan] = useState(false)
	const [copyFeedback, setCopyFeedback] = useState("")
	const [showModelSelector, setShowModelSelector] = useState(false)
	const modelSelectorRef = useRef<HTMLDivElement>(null)
	const buttonRef = useRef<HTMLDivElement>(null)
	const [arrowPosition, setArrowPosition] = useState(0)
	const [menuPosition, setMenuPosition] = useState(0)
	const { width: viewportWidth, height: viewportHeight } = useWindowSize()
	const prevShowModelSelector = useRef(showModelSelector)

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
							partial: message.partial,
						}
						return updatedMessages
					}

					// Otherwise create a new message
					return [
						...prevMessages,
						{
							text: message.text || "",
							role: "assistant",
							timestamp: Date.now(),
							partial: message.partial,
						},
					]
				})

				// Only set generating to false when we get the final message
				if (!message.partial) {
					setIsGenerating(false)
					setHasInitialPlan(true)
				}
			}
		}
		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [onMessageHistoryUpdate])

	const handleOverviewChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const newValue = e.target.value
		setLocalPlan(newValue)
		onUpdate(newValue)
	}

	const handleCopyLatestMessage = useCallback(async () => {
		if (messageHistory.length === 0) return
		const lastMessage = messageHistory[messageHistory.length - 1]
		await navigator.clipboard.writeText(lastMessage.text)
		setCopyFeedback("Copied!")
		setTimeout(() => setCopyFeedback(""), 2000)
	}, [messageHistory])

	const handleSubmit = useCallback(() => {
		if (!localPlan.trim()) return
		setIsGenerating(true)

		// For UI to update the latest user message to keep track of whole user history
		onMessageHistoryUpdate((prevMessages: Message[]) => [
			...prevMessages,
			{
				text: localPlan.trim(),
				role: "user",
				timestamp: Date.now(),
				partial: false,
			},
		])

		// Consolidate message history into a single text block, done so for now because of how CLINE handles API requests, does not accept list of message history as input param
		const consolidatedText = [
			// Add current plan as the latest user message
			...messageHistory.map((msg) => `${msg.role.toUpperCase()}: ${msg.text}`),
			// Add the current plan text
			`USER: ${localPlan.trim()}`,
		].join("\n\n")

		// Format as a single text block that matches Cline's expected format
		vscode.postMessage({
			type: "generatePlan",
			text: JSON.stringify({
				messages: [
					{
						type: "text",
						text: `<task>\n${consolidatedText}\n</task>`,
						isInitialPlan: !hasInitialPlan,
					},
				],
			}),
		})
	}, [localPlan, messageHistory, hasInitialPlan, onMessageHistoryUpdate])

	const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			handleSubmit()
		}
	}

	// Add model selector related functions
	const handleModelButtonClick = () => {
		setShowModelSelector(!showModelSelector)
	}

	useClickAway(modelSelectorRef, () => {
		setShowModelSelector(false)
	})

	useEffect(() => {
		if (showModelSelector && buttonRef.current) {
			const buttonRect = buttonRef.current.getBoundingClientRect()
			const buttonCenter = buttonRect.left + buttonRect.width / 2
			const rightPosition = document.documentElement.clientWidth - buttonCenter - 5
			setArrowPosition(rightPosition)
			setMenuPosition(buttonRect.top + 1)
		}
	}, [showModelSelector, viewportWidth, viewportHeight])

	useEffect(() => {
		if (!showModelSelector) {
			const button = buttonRef.current?.querySelector("a")
			if (button) {
				button.blur()
			}
		}
	}, [showModelSelector])

	// Add submitApiConfig function
	const submitApiConfig = useCallback(() => {
		vscode.postMessage({ type: "apiConfiguration", apiConfiguration })
	}, [apiConfiguration])

	// Update effect to handle menu close
	useEffect(() => {
		if (prevShowModelSelector.current && !showModelSelector) {
			submitApiConfig()
		}
		prevShowModelSelector.current = showModelSelector
	}, [showModelSelector, submitApiConfig])

	// Get model display name
	const modelDisplayName = useMemo(() => {
		const { selectedProvider, selectedModelId } = normalizeApiConfiguration(apiConfiguration)
		const unknownModel = "unknown"
		if (!apiConfiguration) return unknownModel
		switch (selectedProvider) {
			case "anthropic":
			case "openrouter":
				return `${selectedProvider}:${selectedModelId}`
			case "openai":
				return `openai-compat:${selectedModelId}`
			case "vscode-lm":
				return `vscode-lm:${apiConfiguration.vsCodeLmModelSelector ? `${apiConfiguration.vsCodeLmModelSelector.vendor ?? ""}/${apiConfiguration.vsCodeLmModelSelector.family ?? ""}` : unknownModel}`
			default:
				return `${selectedProvider}:${selectedModelId}`
		}
	}, [apiConfiguration])

	return (
		<Container>
			<Header>
				<h2>Start Planning</h2>
			</Header>

			{messageHistory.length > 0 && (
				<ResponseSection>
					<ResponseHeader>
						<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
							<h3>Plan Discussion</h3>
							<VSCodeButton
								appearance="secondary"
								onClick={() => {
									// Only clear local plan history
									onMessageHistoryUpdate(() => [])
									// Reset local plan state
									setHasInitialPlan(false)
									// Clear local plan text
									setLocalPlan("")
								}}>
								Clear History
							</VSCodeButton>
						</div>
					</ResponseHeader>
					<ResponseContent>
						{messageHistory.map((msg, idx) => (
							<div
								key={idx}
								style={{
									marginBottom: 16,
									opacity: msg.role === "user" ? 0.8 : 1,
									position: "relative",
									paddingRight: msg.partial && msg.role === "assistant" ? "12px" : undefined,
								}}>
								<div
									style={{
										fontWeight: 600,
										fontSize: "0.9em",
										marginBottom: 4,
										color: "var(--vscode-descriptionForeground)",
										display: "flex",
										alignItems: "center",
										gap: "8px",
									}}>
									{msg.role === "user" ? (
										"You:"
									) : (
										<>
											Assistant
											{msg.partial && (
												<span
													style={{
														color: "var(--vscode-errorForeground)",
														fontSize: "0.8em",
														opacity: 0.9,
													}}>
													(loading...)
												</span>
											)}
										</>
									)}
								</div>
								<div style={{ position: "relative" }}>
									<MarkdownBlock markdown={msg.text} />
									{msg.partial && msg.role === "assistant" && (
										<div
											style={{
												position: "absolute",
												right: "-12px",
												top: 0,
												bottom: 0,
												width: "4px",
												backgroundColor: "var(--vscode-errorForeground)",
												animation: "blink 1s step-end infinite",
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
					onKeyDown={handleKeyPress}
					rows={8}
					readOnly={readonly || isGenerating}
					placeholder={messageHistory.length > 0 ? "Continue the discussion..." : "Draft your plan here"}
				/>
			</Section>

			{!readonly && (
				<Actions>
					<ModelContainer ref={modelSelectorRef}>
						<ModelButtonWrapper ref={buttonRef}>
							<ModelDisplayButton
								role="button"
								isActive={showModelSelector}
								disabled={readonly || isGenerating}
								onClick={handleModelButtonClick}
								tabIndex={0}>
								<ModelButtonContent>{modelDisplayName}</ModelButtonContent>
							</ModelDisplayButton>
						</ModelButtonWrapper>
						{showModelSelector && (
							<ModelSelectorTooltip
								arrowPosition={arrowPosition}
								menuPosition={menuPosition}
								style={{
									bottom: `calc(100vh - ${menuPosition}px + 6px)`,
								}}>
								<ApiOptions
									showModelOptions={true}
									apiErrorMessage={undefined}
									modelIdErrorMessage={undefined}
									isPopup={true}
								/>
							</ModelSelectorTooltip>
						)}
					</ModelContainer>
					<VSCodeButton appearance="primary" onClick={handleSubmit} disabled={isGenerating || !localPlan.trim()}>
						{isGenerating ? "Generating..." : messageHistory.length > 0 ? "Iterate Plan" : "Generate Plan"}
					</VSCodeButton>
					<VSCodeButton
						appearance="secondary"
						onClick={handleCopyLatestMessage}
						disabled={messageHistory.length === 0 || isGenerating}>
						{copyFeedback || "Copy Latest Plan"}
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
		0%,
		100% {
			border-color: transparent;
		}
		50% {
			border-color: var(--vscode-editor-foreground);
		}
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
