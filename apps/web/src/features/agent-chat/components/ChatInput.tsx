import {
	type CSSProperties,
	type KeyboardEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { IconButton } from "../../../components/buttons/IconButton.js";

interface ChatInputProps {
	onSend: (message: string) => void;
	disabled?: boolean;
	/** When true, show Stop to abort an in-flight streamed response. */
	canCancel?: boolean;
	onCancel?: () => void;
	onStarterFill?: string;
}

const wrapperStyle: CSSProperties = {
	padding: "0 var(--space-5) var(--space-4)",
};

const inputContainerStyle: CSSProperties = {
	background: "var(--bg-elevated)",
	border: "1px solid var(--border)",
	borderRadius: "var(--r-lg)",
	padding: "var(--space-2) var(--space-3)",
	display: "flex",
	alignItems: "center",
	gap: "var(--space-2)",
	transition: "border-color 200ms, box-shadow 200ms",
};

const inputContainerFocusStyle: CSSProperties = {
	borderColor: "var(--border-hover)",
	boxShadow: "0 0 0 3px var(--state-active-soft)",
};

const textareaStyle: CSSProperties = {
	flex: 1,
	background: "transparent",
	border: "none",
	outline: "none",
	color: "var(--text-primary)",
	fontSize: "14px",
	fontFamily: "var(--font-body)",
	lineHeight: 1.5,
	resize: "none",
	minHeight: "21px",
	maxHeight: "126px",
	overflow: "auto",
	padding: 0,
	margin: 0,
};

// 32×32 is intentionally larger than iconButtonBase (24) — send/stop are primary actions
const actionButtonBase: CSSProperties = {
	width: 32,
	height: 32,
	borderRadius: "var(--r-md)",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	flexShrink: 0,
	cursor: "pointer",
	fontSize: "14px",
	transition: "all 150ms ease",
};

const sendButtonStyle: CSSProperties = {
	...actionButtonBase,
	background: "var(--accent)",
	color: "var(--bg-void)",
	border: "none",
};

const stopButtonStyle: CSSProperties = {
	...actionButtonBase,
	background: "transparent",
	color: "var(--text-secondary)",
	border: "1px solid var(--border)",
};

const toolChipsStyle: CSSProperties = {
	display: "flex",
	gap: "var(--space-3)",
	padding: "var(--space-1) var(--space-1) 0",
	fontSize: "11px",
	color: "var(--text-dim)",
};

export function ChatInput({
	onSend,
	disabled,
	canCancel,
	onCancel,
	onStarterFill,
}: ChatInputProps) {
	const [value, setValue] = useState("");
	const [focused, setFocused] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// Handle starter prompt fill
	const lastFill = useRef<string | undefined>(undefined);
	useEffect(() => {
		if (!onStarterFill || onStarterFill === lastFill.current) return;
		lastFill.current = onStarterFill;
		setValue(onStarterFill);
		// Focus textarea after fill
		setTimeout(() => textareaRef.current?.focus(), 0);
	}, [onStarterFill]);

	const adjustHeight = useCallback(() => {
		const ta = textareaRef.current;
		if (!ta) return;
		ta.style.height = "auto";
		ta.style.height = `${Math.min(ta.scrollHeight, 126)}px`;
	}, []);

	const handleSend = useCallback(() => {
		const trimmed = value.trim();
		if (!trimmed || disabled) return;
		onSend(trimmed);
		setValue("");
		lastFill.current = undefined;
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}
	}, [value, disabled, onSend]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSend();
			}
		},
		[handleSend],
	);

	const isEmpty = value.trim().length === 0;
	const isDisabled = disabled || isEmpty;
	const showStop = Boolean(canCancel && onCancel);

	return (
		<div style={wrapperStyle}>
			<div
				style={{
					...inputContainerStyle,
					...(focused ? inputContainerFocusStyle : {}),
				}}
			>
				<textarea
					ref={textareaRef}
					style={textareaStyle}
					value={value}
					onChange={(e) => {
						setValue(e.target.value);
						adjustHeight();
					}}
					onKeyDown={handleKeyDown}
					onFocus={() => setFocused(true)}
					onBlur={() => setFocused(false)}
					placeholder={
						disabled ? "Agent is responding..." : "Ask about your campaign..."
					}
					disabled={disabled}
					rows={1}
					aria-label="Chat message input"
				/>
				{showStop && (
					<IconButton
						label="Stop generation"
						size={32}
						style={stopButtonStyle}
						hoverStyle={{
							borderColor: "var(--border-hover)",
							color: "var(--text-primary)",
						}}
						pressStyle={{ transform: "scale(0.96)" }}
						onClick={() => onCancel?.()}
					>
						&#x25A0;
					</IconButton>
				)}
				<IconButton
					label="Send message"
					size={32}
					disabled={isDisabled}
					style={{
						...sendButtonStyle,
						opacity: isDisabled ? 0.4 : 1,
						cursor: isDisabled ? "not-allowed" : "pointer",
					}}
					hoverStyle={{
						background: "var(--accent-hover)",
						transform: "scale(1.04)",
					}}
					pressStyle={{ transform: "scale(0.96)" }}
					onClick={handleSend}
				>
					&#x2191;
				</IconButton>
			</div>
			<div style={toolChipsStyle}>
				<span>/ commands</span>
				<span>@ entity</span>
				<span># tag</span>
				<span>&#x1F4CE; attach</span>
				<span>quick ref &#x2318;J</span>
			</div>
		</div>
	);
}
