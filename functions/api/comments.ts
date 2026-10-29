import { handleComments, type CommentEnvironment } from '../../src/server/comments.ts';

export function onRequest(context: { request: Request; env: CommentEnvironment }) {
  return handleComments(context.request, context.env);
}
