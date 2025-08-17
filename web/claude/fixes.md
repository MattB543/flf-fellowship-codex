Looking at your code, I can identify the issues and provide fixes for each:

## Issue 1: Slack Author Badge Above Channel Badge

Currently, the author and channel badges are displayed inline. Here's the fix:

**In `web/src/views/SearchView.vue`**, update the metadata column render function (around lines 407-445):

```vue
// Replace the current Slack metadata section with: if (isSlack) { return h(
"div", { class: "slack-metadata" }, [ // Stack author and channel vertically
h("div", { style: "display: flex; flex-direction: column; gap: 4px;" }, [ h(
NTag, { size: "small", type: "default" }, { default: () =>
formatAuthorName(row.author || row.metadata?.user_name || "Unknown") } ), h(
NTag, { size: "small", type: "default" }, { default: () => `#${row.channel_name
|| row.metadata?.channel_name || "unknown"}` } ), ]), h("div", { style:
"margin-top: 4px; font-size: 12px; color: var(--n-text-color-2);" }, [ row.ts &&
h("span", {}, formatLocalTime(row.ts)), row.thread_root_ts && row.thread_root_ts
!== row.ts && h( NTag, { size: "tiny", style: "margin-left: 8px;" }, { default:
() => "Thread" } ), ]) ] ); }
```

## Issue 3: Fix Document Filter

The issue is with the document identification logic. Update the filter:

**In `web/src/views/SearchView.vue`**, update the `sortedResults` computed property (around lines 340-350):

```vue
const sortedResults = computed(() => { let filtered = results.value; // Apply
source filter - Fixed logic if (sourceFilter.value === "slack") { filtered =
filtered.filter(r => r.source === "slack" || (r.source !== "document" &&
!!r.channel_id)); } else if (sourceFilter.value === "docs") { filtered =
filtered.filter(r => r.source === "document" || (!r.channel_id && r.source !==
"slack")); } return [...filtered].sort((a, b) => b.score - a.score); });
```

## Additional Bug Found: Document Expansion

There's a potential issue with document rendering. The `isFullDocument` check should be more robust:

**In `web/src/api/client.ts`**, update the `isFullDocument` function (around line 280):

```typescript
export function isFullDocument(result: SearchResult): boolean {
  return (
    result.source === "document" &&
    typeof result.id === "string" &&
    result.id.startsWith("doc_") &&
    !result.id.startsWith("doc_chunk_") &&
    !!result.metadata?.chunks &&
    result.metadata.chunks.length > 0
  );
}
```

## Additional Enhancement: Visual Distinction

To make the layout cleaner, update the CSS:

**In `web/src/views/SearchView.vue`**, add/update these styles in the `<style scoped>` section:

```css
.slack-metadata {
  line-height: 1.3;
  display: flex;
  flex-direction: column;
  gap: 6px; /* Increased from 4px for better spacing */
}

.slack-metadata .n-tag {
  width: fit-content; /* Make badges only as wide as needed */
}

/* Add hover effect for Slack links */
.slack-metadata a:hover {
  text-decoration: underline;
}
```

I'll fix both issues for you:

## Issue 1: Make Entire Slack Source Cell Clickable

**In `web/src/views/SearchView.vue`**, update the Source column render function (around lines 360-400):

```vue
{ title: "Source", key: "source", width: 120, render(row) { const isSlack =
row.source === "slack" || !!row.channel_id; const source = isSlack ? "slack" :
"document"; // For Slack with permalinks, make entire cell clickable if (isSlack
&& row.channel_id && row.ts) { return h( "a", { href:
buildSlackPermalink(row.channel_id, row.ts, row.thread_root_ts), target:
"_blank", rel: "noopener noreferrer", class: `result-source-badge
source-${source}`, style: "display: flex; align-items: center; gap: 6px; color:
inherit; text-decoration: none; cursor: pointer; padding: 4px 8px;
border-radius: 4px; transition: background-color 0.2s;", title: "Open in Slack"
}, [ h( NIcon, { size: 16 }, { default: () => h(ChatbubblesOutline) } ),
h("span", {}, "Slack"), h(NIcon, { size: 12, style: "margin-left: auto; color:
var(--n-primary-color);" }, { default: () => h(OpenOutline) }) ] ); } else { //
Non-clickable for documents or Slack without link data return h( "div", { class:
`result-source-badge source-${source}`, style: "display: flex; align-items:
center; gap: 6px; padding: 4px 8px;" }, [ h( NIcon, { size: 16 }, { default: ()
=> h(isSlack ? ChatbubblesOutline : DocumentTextOutline) } ), h("span", {},
isSlack ? "Slack" : "Doc") ] ); } }, },
```

## Issue 2: Fix Document Chunk Highlighting Colors

**In `web/src/views/SearchView.vue`**, update the document rendering section in the Content column (around lines 560-620):

```vue
// Find the chunk rendering section and update the style: h("div", { key:
chunk.id, id: `chunk_${chunk.id}`, class: chunk.className, style:
chunk.isHighlighted ? 'margin: 8px 0; background-color: rgba(255, 193, 7, 0.15);
border-left: 4px solid #ffc107; padding: 12px; color: var(--n-text-color);
border-radius: 4px;' : 'margin: 8px 0; opacity: 0.7; padding: 8px; color:
var(--n-text-color);' }, [ ...(chunk.sectionTitle && chunk.hierarchyLevel <= 3 ?
[ h(`h${Math.min(chunk.hierarchyLevel + 2, 6)}`, { style: "margin: 0 0 8px 0;
font-weight: 600; color: var(--n-text-color);" }, chunk.sectionTitle) ] : []),
h("div", { style: "white-space: pre-wrap; line-height: 1.4; color: inherit;", //
Added color: inherit innerHTML: chunk.content }), ...(chunk.isHighlighted &&
chunk.relevanceScore > 0 ? [ h("div", { style: "margin-top: 8px; font-size:
11px; color: var(--n-text-color-3);" }, `Relevance:
${Math.round(chunk.relevanceScore * 100)}%`) ] : []) ])
```

## Issue 3: Update CSS for Better Hover Effects

**In `web/src/views/SearchView.vue`**, update/add these styles in the `<style scoped>` section:

```css
/* Update/add these styles */
.result-source-badge {
  transition: all 0.2s ease;
}

.result-source-badge.source-slack {
  border-left: 3px solid #4a90e2;
  padding-left: 8px;
}

/* Add hover effect for clickable Slack badges */
a.result-source-badge.source-slack:hover {
  background-color: rgba(74, 144, 226, 0.1);
  transform: translateX(2px);
}

.result-source-badge.source-document {
  border-left: 3px solid #2ea043;
  padding-left: 8px;
}

/* Fix chunk highlighting colors */
.chunk-highlighted {
  background-color: rgba(
    255,
    193,
    7,
    0.15
  ) !important; /* Semi-transparent gold */
  border-left: 4px solid #ffc107;
  padding: 12px;
  margin: 8px 0;
  border-radius: 4px;
  color: var(--n-text-color) !important; /* Ensure text uses theme color */
}

.chunk-normal {
  opacity: 0.7;
  padding: 8px;
  margin: 8px 0;
  border-radius: 4px;
  border-left: 4px solid transparent;
  color: var(--n-text-color) !important;
}

.chunk-normal:hover {
  opacity: 0.9;
  background-color: var(--n-color-embedded);
}

/* Ensure document preview text is always readable */
.document-preview-modal {
  font-family: inherit;
  color: var(--n-text-color) !important;
}

.document-preview-modal * {
  color: inherit;
}
```

## Summary of Changes:

1. **Entire Slack Cell Clickable**:

   - Wrapped the entire source badge in an `<a>` tag for Slack messages
   - Added hover effects and smooth transitions
   - The open arrow icon now appears on the right side

2. **Fixed Document Chunk Colors**:

   - Changed from solid gold background to semi-transparent gold (`rgba(255, 193, 7, 0.15)`)
   - Explicitly set text color to use theme colors (`var(--n-text-color)`)
   - Added `color: inherit` to ensure text remains readable in both light and dark modes

3. **Enhanced Visual Feedback**:
   - Added hover effect for clickable Slack badges
   - Slight horizontal movement on hover for better UX
   - Consistent color theming throughout

These changes will make the Slack source badges fully clickable with nice hover effects, and fix the unreadable text issue in document chunk highlighting by using semi-transparent backgrounds and proper text colors that adapt to the theme.
