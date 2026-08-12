import {
  parseBlockSuggestions,
  parseComments,
  type ParsedBlockSuggestion,
  type ParsedComment,
} from "../markdown/comments";

export interface ReviewSuggestionDiscussion {
  suggestion: ParsedBlockSuggestion;
  addressedComments: ParsedComment[];
  suggestionComments: ParsedComment[];
}

export interface ReviewAnalysis {
  comments: ParsedComment[];
  suggestions: ParsedBlockSuggestion[];
  discussions: ReviewSuggestionDiscussion[];
  suggestionIdByCommentId: ReadonlyMap<string, string>;
}

type ParseComments = (markdown: string) => ParsedComment[];
type ParseBlockSuggestions = (markdown: string) => ParsedBlockSuggestion[];

export function reviewSuggestionDiscussionsFromParsed(
  comments: ParsedComment[],
  suggestions: ParsedBlockSuggestion[],
): ReviewSuggestionDiscussion[] {
  const commentsById = new Map(comments.map((comment) => [comment.id, comment]));
  return suggestions.map((suggestion) => {
    const addressedComments = suggestion.relatedCommentIds
      .map((id) => commentsById.get(id))
      .filter((comment): comment is ParsedComment => Boolean(comment));
    const suggestionComments = comments.filter(
      (comment) =>
        !suggestion.relatedCommentIds.includes(comment.id) &&
        comment.kind !== "dangling" &&
        comment.markerSourceStart >= suggestion.definitionSourceStart &&
        comment.markerSourceStart <= suggestion.definitionSourceEnd,
    );
    return { suggestion, addressedComments, suggestionComments };
  });
}

export function createReviewAnalysisCache(
  parseCommentsFn: ParseComments = parseComments,
  parseBlockSuggestionsFn: ParseBlockSuggestions = parseBlockSuggestions,
): (markdown: string) => ReviewAnalysis {
  let cachedMarkdown: string | undefined;
  let cachedAnalysis: ReviewAnalysis | undefined;

  return (markdown) => {
    if (cachedAnalysis && cachedMarkdown === markdown) return cachedAnalysis;

    const comments = parseCommentsFn(markdown);
    const suggestions = parseBlockSuggestionsFn(markdown);
    const suggestionIdByCommentId = new Map<string, string>();
    for (const suggestion of suggestions) {
      for (const commentId of suggestion.relatedCommentIds) {
        suggestionIdByCommentId.set(commentId, suggestion.id);
      }
    }

    cachedMarkdown = markdown;
    cachedAnalysis = {
      comments,
      suggestions,
      discussions: reviewSuggestionDiscussionsFromParsed(comments, suggestions),
      suggestionIdByCommentId,
    };
    return cachedAnalysis;
  };
}
