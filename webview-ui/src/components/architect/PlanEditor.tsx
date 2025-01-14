import React, { useState, useEffect } from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import styled from "styled-components"
import { vscode } from "../../utils/vscode"

interface PlanEditorProps {
	plan: string
	onUpdate: (plan: string) => void
	readonly?: boolean
}

const PlanEditor: React.FC<PlanEditorProps> = ({ plan, onUpdate, readonly }) => {
	const [localPlan, setLocalPlan] = useState(plan)

	useEffect(() => {
		setLocalPlan(plan)
	}, [plan])

	const handleOverviewChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const newValue = e.target.value
		setLocalPlan(newValue)
		onUpdate(newValue)
	}

	const handleSubmit = () => {
		vscode.postMessage({
			type: "askResponse",
			askResponse: "messageResponse",
			text: localPlan,
		})
	}

	return (
		<Container>
			<Header>
				<h2>Start Planning</h2>
			</Header>

			<Section>
				<label>Plan</label>
				<StyledTextArea
					value={localPlan}
					onChange={handleOverviewChange}
					rows={8}
					readOnly={readonly}
					placeholder="Start writing plan..."
				/>
			</Section>

			{!readonly && (
				<Actions>
					<VSCodeButton appearance="primary" onClick={handleSubmit}>
						Submit Plan
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

export default PlanEditor
