import { trpc } from "@/lib/trpc.js";
import { useState } from "react";
import type { LogComment } from "../utils/types.js";

interface CommentThreadProps {
	ticketId: string;
}

/**
 * Comment thread for one Log entry — existing comments (author chip +
 * timestamp + body) plus an add-comment form, per the mockup
 * (`Docs/mockups/observability-dashboard/log.html`). Alex-authored only for
 * v1 (T-059's `author` is hardcoded server-side) — see this ticket's Out of
 * scope.
 */
export function CommentThread({ ticketId }: CommentThreadProps) {
	const [body, setBody] = useState("");
	const utils = trpc.useUtils();
	const { data } = trpc.comment.list.useQuery({ ticketId });
	const addComment = trpc.comment.add.useMutation({
		onSuccess: () => utils.comment.list.invalidate({ ticketId }),
	});
	const comments = (data ?? []) as LogComment[];

	function handleAdd() {
		const trimmed = body.trim();
		if (!trimmed) return;
		addComment.mutate(
			{ ticketId, body: trimmed },
			{ onSuccess: () => setBody("") },
		);
	}

	return (
		<div className="comments">
			<div className="comment-list">
				{comments.map((comment) => (
					<div className="comment" key={comment.id}>
						<span className={`author-chip ${comment.author}`}>
							{comment.author}
						</span>
						<div>
							<div className="comment-body">{comment.body}</div>
							<div className="comment-meta">
								{new Date(comment.createdAt)
									.toISOString()
									.slice(0, 16)
									.replace("T", " ")}
							</div>
						</div>
					</div>
				))}
			</div>
			<div className="comment-add">
				<textarea
					placeholder="Add a comment…"
					value={body}
					onChange={(e) => setBody(e.target.value)}
				/>
				<button type="button" className="btn-secondary" onClick={handleAdd}>
					Add Comment
				</button>
			</div>
		</div>
	);
}
