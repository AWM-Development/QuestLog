export type AuthorizeFields = {
	response_type: "code";
	client_id: string;
	redirect_uri: string;
	code_challenge: string;
	code_challenge_method: "S256";
	resource: string;
	state?: string;
};

export function baseUrl(request: {
	protocol: string;
	headers: { host?: string };
}) {
	return `${request.protocol}://${request.headers.host}`;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

/** No framework, no design system — a one-time, one-user passphrase prompt. */
export function renderAuthorizeForm(
	fields: AuthorizeFields,
	error?: string,
): string {
	const hidden = (name: string, value: string) =>
		`<input type="hidden" name="${name}" value="${escapeHtml(value)}">`;
	return `<!doctype html>
<html>
<head><title>QuestLog MCP — Sign in</title></head>
<body>
<h1>QuestLog MCP</h1>
${error ? `<p>${escapeHtml(error)}</p>` : ""}
<form method="POST" action="/authorize">
${hidden("response_type", fields.response_type)}
${hidden("client_id", fields.client_id)}
${hidden("redirect_uri", fields.redirect_uri)}
${hidden("code_challenge", fields.code_challenge)}
${hidden("code_challenge_method", fields.code_challenge_method)}
${hidden("resource", fields.resource)}
${fields.state !== undefined ? hidden("state", fields.state) : ""}
<label for="passphrase">Passphrase</label>
<input type="password" id="passphrase" name="passphrase" autofocus>
<button type="submit">Continue</button>
</form>
</body>
</html>`;
}
