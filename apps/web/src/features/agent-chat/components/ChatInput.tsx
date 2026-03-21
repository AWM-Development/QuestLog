import {
	type CSSProperties,
	type KeyboardEvent,
	useCallback,
	useRef,
	useState,
} from "react";

interface ChatInputProps {
	onSend: (message: string) => void;
	disabled?: boolean;
	onStarterFill?: string;
}

const wrapperStyle: CSSProperties = {
	padding: "0 20px 16px",
};

const inputContainerStyle: CSSProperties = {
	background: "var(--bg-elevated)",
	border: "1px solid var(--border)",
	borderRadius: "var(--r-lg)",
	padding: "10px 14px",
	display: "flex",
	alignItems: "flex-end",
	gap: "8px",
	transition: "border-color 200ms, box-shadow 200ms",
};

const inputContainerFocusStyle: CSSProperties = {
	borderColor: "var(--border-hover)",
	boxShadow: "0 0 0 3px rgba(96,184,255,0.06)",
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
};

const sendButtonStyle: CSSProperties = {
	width: 36,
	height: 36,
	borderRadius: "var(--r-md)",
	background: "var(--accent)",
	color: "var(--bg-void)",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	flexShrink: 0,
	cursor: "pointer",
	border: "none",
	fontSize: "14px",
	transition: "all 150ms ease",
};

const toolChipsStyle: CSSProperties = {
	display: "flex",
	gap: "12px",
	padding: "6px 4px 0",
	fontSize: "11px",
	color: "var(--text-dim)",
};

export function ChatInput({ onSend, disabled, onStarterFill }: ChatInputProps) {
	const [value, setValue] = useState("");
	const [focused, setFocused] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// Handle starter prompt fill
	const lastFill = useRef<string | undefined>(undefined);
	if (onStarterFill && onStarterFill !== lastFill.current) {
		lastFill.current = onStarterFill;
		setValue(onStarterFill);
		// Focus textarea after fill
		setTimeout(() => textareaRef.current?.focus(), 0);
	}

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
				<button
					type="button"
					style={{
						...sendButtonStyle,
						opacity: isDisabled ? 0.4 : 1,
						cursor: isDisabled ? "not-allowed" : "pointer",
					}}
					disabled={isDisabled}
					onClick={handleSend}
					aria-label="Send message"
				>
					&#x2191;
				</button>
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
