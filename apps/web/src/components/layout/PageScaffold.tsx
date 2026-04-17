import type { CSSProperties, ReactNode } from "react";
import {
	pageContainer,
	pageHeaderRow,
	pageSubtitle,
	pageTitle,
} from "../styles.js";

interface PageContainerProps {
	children: ReactNode;
	style?: CSSProperties;
}

interface PageHeaderProps {
	title: string;
	subtitle?: string;
	actions?: ReactNode;
}

export function PageContainer({ children, style }: PageContainerProps) {
	return <div style={{ ...pageContainer, ...style }}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
	return (
		<div style={pageHeaderRow}>
			<div>
				<h1 style={pageTitle}>{title}</h1>
				{subtitle && <p style={pageSubtitle}>{subtitle}</p>}
			</div>
			{actions}
		</div>
	);
}
