Looking at your code carefully, I can identify several issues. Let me provide comprehensive fixes:

## Issue 1: Source Column Slack Detection Logic

The Slack detection is too restrictive. It's checking for `row.source === "slack"` but your data might not always have that exact value.

**In `web/src/views/SearchView.vue`**, fix the Source column (around line 360-400):

```vue
{ title: "Source", key: "source", width: 120, render(row) { // More permissive
Slack detection - match the filter logic const isSlack = row.source === "slack"
|| (row.source !== "document" && !!row.channel_id); const hasPermalinkData =
!!row.channel_id && !!row.ts; const source = isSlack ? "slack" : "document"; //
For Slack with complete permalink data, make entire cell clickable if (isSlack
&& hasPermalinkData) { return h( "a", { href:
buildSlackPermalink(row.channel_id, row.ts, row.thread_root_ts), target:
"_blank", rel: "noopener noreferrer", class: `result-source-badge
source-${source}`, style: "display: flex; align-items: center; gap: 6px; color:
inherit; text-decoration: none; cursor: pointer; padding: 4px 8px;
border-radius: 4px; transition: background-color 0.2s;", title: "Open in Slack"
}, [ h( NIcon, { size: 16 }, { default: () => h(ChatbubblesOutline) } ),
h("span", {}, "Slack"), h(NIcon, { size: 12, style: "margin-left: auto; color:
var(--n-primary-color);" }, { default: () => h(OpenOutline) }) ] ); } else { //
Non-clickable for documents or Slack messages without complete permalink data
const displaySource = isSlack ? "Slack" : "Doc"; const icon = isSlack ?
ChatbubblesOutline : DocumentTextOutline; return h( "div", { class:
`result-source-badge source-${source}`, style: "display: flex; align-items:
center; gap: 6px; padding: 4px 8px;" }, [ h( NIcon, { size: 16 }, { default: ()
=> h(icon) } ), h("span", {}, displaySource) ] ); } }, },
```

## Issue 2: Fix Badge Stretching in Metadata Column

**In `web/src/views/SearchView.vue`**, update the Metadata column (around line 407-445):

```vue
{ title: "Metadata", key: "metadata", width: 200, render(row) { const isSlack =
row.source === "slack" || (row.source !== "document" && !!row.channel_id); if
(isSlack) { return h( "div", { class: "slack-metadata" }, [ // Use align-items:
flex-start to prevent stretching h("div", { style: "display: flex;
flex-direction: column; gap: 4px; align-items: flex-start;" }, [ h( NTag, {
size: "small", type: "default", style: "width: fit-content;" }, { default: () =>
formatAuthorName(row.author || row.metadata?.user_name || "Unknown") } ), h(
NTag, { size: "small", type: "default", style: "width: fit-content;" }, {
default: () => `#${row.channel_name || row.metadata?.channel_name || "unknown"}`
} ), ]), h("div", { style: "margin-top: 4px; font-size: 12px; color:
var(--n-text-color-2); display: flex; align-items: center; gap: 8px;" }, [
row.ts && h("span", {}, formatLocalTime(row.ts)), row.thread_root_ts &&
row.thread_root_ts !== row.ts && h( NTag, { size: "tiny", style: "width:
fit-content;" }, { default: () => "Thread" } ), // More prominent Slack
permalink row.channel_id && row.ts && h( "a", { href:
buildSlackPermalink(row.channel_id, row.ts, row.thread_root_ts), target:
"_blank", rel: "noopener noreferrer", style: "display: inline-flex; align-items:
center; gap: 4px; color: var(--n-primary-color); text-decoration: none;
font-size: 12px;", title: "Open in Slack" }, [ h(NIcon, { size: 14 }, { default:
() => h(OpenOutline) }), h("span", {}, "Open") ] ) ]) ] ); } else { // Document
metadata remains the same return h( "div", { class: "doc-metadata" }, [ h("div",
{ style: "font-weight: 500; font-size: 13px;" }, row.metadata?.document_title ||
"Document"), row.metadata?.section_title && h( "div", { style: "font-size: 12px;
color: var(--n-text-color-2); margin-top: 2px;" }, `§
${row.metadata.section_title}` ), ...(row.metadata?.has_tables ? [h("div", {
style: "margin-top: 4px; display: flex; gap: 4px; flex-wrap: wrap;" }, [ h(
NTag, { size: "tiny", type: "success" }, { default: () => "Tables" } ) ])] : [])
] ); } }, },
```

## Issue 3: Replace Tooltip with Custom Popover

This is a more complex change. Instead of using NTooltip, we'll create a custom popover that appears to the right of the content.

**First, add a new state variable at the top of the script section in `web/src/views/SearchView.vue`**:

```javascript
// Add after other state variables (around line 95)
const hoveredRowId = (ref < string) | number | (null > null);
const popoverPosition = ref({ top: 0, left: 0 });
const popoverContent = ref < any > null;
```

**Then replace the Content column** (around line 460-620):

```vue
{ title: "Content", key: "text", render(row) { const hasThread =
!!row.thread_root_ts && row.thread_root_ts !== row.ts; const content =
row.content || row.text; const isSlack = row.source === "slack" ||
!!row.channel_id; const isDocumentExpanded = isFullDocument(row); // Preview
content for trigger let previewContent = content; let docStats = null; if
(isDocumentExpanded) { docStats = getDocumentStats(row); previewContent =
`${docStats?.documentTitle || 'Document'} - ${docStats?.relevantSections || 0}
relevant sections`; } return h( "div", { style: "display: flex; align-items:
flex-start; gap: 6px; cursor: pointer; width: 100%; position: relative;", class:
`result-content-preview source-${isSlack ? "slack" : "document"}
${isDocumentExpanded ? 'document-expanded' : ''}`, onMouseenter: (e: MouseEvent)
=> { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
popoverPosition.value = { top: rect.top + window.scrollY, left: rect.right + 250
// 250px to the right of content column }; hoveredRowId.value = row.id; // Set
popover content based on row type if (isSlack && hasThread && row.channel_id &&
row.ts) { popoverContent.value = h(ThreadPreview, { channel_id: row.channel_id,
thread_root_ts: row.thread_root_ts as string, highlight_ts: row.ts, eagerRow:
row as any, }); } else if (isDocumentExpanded) { // Document expansion content
(same as before) const documentData = reconstructDocument(row); if
(documentData) { const renderedChunks =
renderDocumentWithHighlights(documentData); popoverContent.value = h( "div", {
style: "border: 1px solid #e5e7eb; border-radius: 8px; padding: 0; background:
var(--n-color); max-height: 600px; overflow: auto; min-width: 600px", class:
"document-preview-modal" }, [ // Document header and chunks (same as before) //
... (keep the existing document rendering code) ] ); } } else { // Regular
content preview popoverContent.value = h( "div", { style: "border: 1px solid
#e5e7eb; border-radius: 8px; padding: 12px; background: var(--n-color);
max-height: 480px; overflow: auto; min-width: 400px", class: `content-preview
${isSlack ? 'slack-content' : 'document-content'}` }, [ // ... (keep the
existing content preview code) ] ); } }, onMouseleave: () => { setTimeout(() =>
{ hoveredRowId.value = null; popoverContent.value = null; }, 100); // Small
delay to prevent flicker } }, [ h( NEllipsis, { lineClamp: 2, style: "flex: 1;
min-width: 0", tooltip: false, }, { default: () => previewContent } ),
...(isDocumentExpanded && docStats ? [ h( NTag, { size: "tiny", type: "info",
style: "margin-left: 8px;" }, { default: () =>
`${docStats.relevantSections}/${docStats.totalSections}` } ) ] : []) ] ); }, },
```

**Add a teleported popover in the template** (add this before the closing `</div>` of search-view):

```vue
<!-- Add this before the closing </div> of search-view -->
<Teleport to="body">
  <div
    v-if="hoveredRowId !== null && popoverContent"
    :style="{
      position: 'absolute',
      top: `${popoverPosition.top}px`,
      left: `${popoverPosition.left}px`,
      zIndex: 9999,
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      borderRadius: '8px',
      maxWidth: 'calc(100vw - ' + (popoverPosition.left + 20) + 'px)',
    }"
    @mouseenter="() => { /* Keep popover open */ }"
    @mouseleave="() => { hoveredRowId = null; popoverContent = null; }"
  >
    <component :is="popoverContent" />
  </div>
</Teleport>
```

## Issue 4: Update CSS for Better Visual Consistency

**In the `<style scoped>` section of `web/src/views/SearchView.vue`**, update:

```css
/* Ensure badges don't stretch */
.slack-metadata {
  line-height: 1.3;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.slack-metadata .n-tag {
  width: fit-content !important;
  flex-shrink: 0;
}

/* Better hover for source badges */
.result-source-badge {
  transition: all 0.2s ease;
  user-select: none;
}

.result-source-badge.source-slack {
  border-left: 3px solid #4a90e2;
  padding-left: 8px !important;
}

a.result-source-badge.source-slack:hover {
  background-color: rgba(74, 144, 226, 0.1) !important;
  transform: translateX(2px);
}

.result-source-badge.source-document {
  border-left: 3px solid #2ea043;
  padding-left: 8px !important;
}

/* Content preview hover effect */
.result-content-preview {
  transition: background-color 0.2s;
}

.result-content-preview:hover {
  background-color: rgba(0, 0, 0, 0.02);
}
```

## Issue 5: Fix Document Filter

The filter logic is already correct, but make sure the source detection is consistent:

```javascript
// In sortedResults computed property (around line 340)
const sortedResults = computed(() => {
  let filtered = results.value;

  // Apply source filter with consistent logic
  if (sourceFilter.value === "slack") {
    filtered = filtered.filter(
      (r) => r.source === "slack" || (r.source !== "document" && !!r.channel_id)
    );
  } else if (sourceFilter.value === "docs") {
    filtered = filtered.filter(
      (r) => r.source === "document" || (!r.channel_id && r.source !== "slack")
    );
  }

  return [...filtered].sort((a, b) => b.score - a.score);
});
```

These changes should fix:

1. ✅ Badge stretching issues (added `width: fit-content` and `align-items: flex-start`)
2. ✅ Slack permalinks in source column (fixed detection logic)
3. ✅ Popover positioning (replaced tooltip with custom positioned popover)
4. ✅ Visual consistency and hover effects
5. ✅ Filter functionality

The key improvements are:

- More permissive Slack detection that matches your filter logic
- Proper flex container alignment to prevent badge stretching
- Custom popover implementation instead of tooltip for better positioning control
- Consistent source detection throughout the component
