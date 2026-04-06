import { Component, type ReactNode } from "react";
import { useNavigate, useRouteError } from "react-router";
import { buttonAccent, buttonSecondary, pageContainer } from "./styles.js";

/** Route-level error element for react-router's errorElement prop. */
export function RouteErrorBoundary() {
	const error = useRouteError();
	const navigate = useNavigate();

	const is404 =
		error instanceof Response
			? error.status === 404
			: error instanceof Error && error.message.includes("404");

	return (
		<div
			style={{
				...pageContainer,
				margin: "0 auto",
				padding: "var(--space-8) var(--space-6)",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				minHeight: "60vh",
				textAlign: "center",
			}}
		>
			<h1
				style={{
					fontFamily: "var(--font-display)",
					fontSize: "3rem",
					fontWeight: 700,
					color: "var(--text-primary)",
					marginBottom: "var(--space-2)",
				}}
			>
				{is404 ? "404" : "Something went wrong"}
			</h1>
			<p
				style={{
					fontSize: "1rem",
					color: "var(--text-secondary)",
					marginBottom: "var(--space-8)",
					maxWidth: "420px",
					lineHeight: 1.6,
				}}
			>
				{is404
					? "The page you're looking for doesn't exist or has been moved."
					: "An unexpected error occurred. Try refreshing the page."}
			</p>
			<div style={{ display: "flex", gap: "var(--space-3)" }}>
				<button
					type="button"
					style={buttonAccent}
					onClick={() => navigate("/campaigns")}
				>
					Go to Campaigns
				</button>
				<button
					type="button"
					style={buttonSecondary}
					onClick={() => window.location.reload()}
				>
					Refresh page
				</button>
			</div>
		</div>
	);
}

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
}

interface State {
	hasError: boolean;
}

/** Generic component-level error boundary for wrapping subtrees. */
export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(): State {
		return { hasError: true };
	}

	render() {
		if (this.state.hasError) {
			return (
				this.props.fallback ?? (
					<div
						style={{
							padding: "var(--space-8)",
							textAlign: "center",
							color: "var(--text-secondary)",
						}}
					>
						<p
							style={{
								fontFamily: "var(--font-display)",
								fontSize: "1.25rem",
								fontWeight: 600,
								color: "var(--text-primary)",
								marginBottom: "var(--space-2)",
							}}
						>
							Something went wrong
						</p>
						<p style={{ fontSize: "0.875rem", marginBottom: "var(--space-4)" }}>
							Try refreshing the page.
						</p>
						<button
							type="button"
							style={buttonSecondary}
							onClick={() => {
								this.setState({ hasError: false });
								window.location.reload();
							}}
						>
							Refresh
						</button>
					</div>
				)
			);
		}

		return this.props.children;
	}
}
