import { useEffect, useId, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Megaphone, ImagePlus, X, Pencil, FileText, UploadCloud, Trash2, Sparkles } from "lucide-react";
import { Panel } from "../../components/ui/Panel";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { EmptyState } from "../../components/ui/EmptyState";
import { useAuth } from "../../context/AuthContext";
import { getAnnouncements, postAnnouncement, editAnnouncement, draftAnnouncementFromNews } from "../../api/admin";
import { ingestDocument, getDocuments, deleteDocument } from "../../api/rag";

// A composer with an image picker — reused for both "post new" (top of the
// page) and "edit an existing one" (inline, in place of that card in the
// list below), same fields either way.
function AnnouncementForm({ initial, submitLabel, onSubmit, onCancel, busy }) {
  const uid = useId();
  const contentId = `announcement-content-${uid}`;
  const imageId = `announcement-image-${uid}`;
  const fileInputRef = useRef(null);
  const [title, setTitle] = useState(initial?.title || "");
  const [content, setContent] = useState(initial?.content || "");
  const [benefit, setBenefit] = useState(initial?.benefit || "");
  const [eligibility, setEligibility] = useState(initial?.eligibility || "");
  const [whereToApply, setWhereToApply] = useState(initial?.where_to_apply || "");
  const [officialLink, setOfficialLink] = useState(initial?.official_link || "");
  const [schemeStatus, setSchemeStatus] = useState(initial?.status || "active");
  const [showSchemeFields, setShowSchemeFields] = useState(
    !!(initial?.benefit || initial?.eligibility || initial?.where_to_apply || initial?.official_link)
  );
  const [showDraftPanel, setShowDraftPanel] = useState(false);
  const [draftArticleTitle, setDraftArticleTitle] = useState("");
  const [draftArticleText, setDraftArticleText] = useState("");
  const [draftArticleUrl, setDraftArticleUrl] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(initial?.image_url || null);

  function handleImageChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    onSubmit({
      title: title.trim(),
      content: content.trim(),
      benefit: benefit.trim(),
      eligibility: eligibility.trim(),
      where_to_apply: whereToApply.trim(),
      official_link: officialLink.trim(),
      scheme_status: showSchemeFields ? schemeStatus : "active",
      imageFile,
    });
  }

  // Fills the form fields with an AI-drafted first pass — does NOT post
  // anything. The admin still reviews/edits every field and clicks the
  // normal Post/Save button below, same as writing it by hand.
  async function handleDraft() {
    if (!draftArticleTitle.trim()) return;
    setDrafting(true);
    try {
      const draft = await draftAnnouncementFromNews({
        title: draftArticleTitle.trim(),
        source_text: draftArticleText.trim(),
        url: draftArticleUrl.trim(),
      });
      setTitle(draft.title || draftArticleTitle.trim());
      setContent(draft.content || "");
      setBenefit(draft.benefit || "");
      setEligibility(draft.eligibility || "");
      setWhereToApply(draft.where_to_apply || "");
      setOfficialLink(draft.official_link || draftArticleUrl.trim());
      setShowSchemeFields(true);
      setShowDraftPanel(false);
      toast.success("Draft filled in below — review and edit before posting");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Couldn't draft from that article. Try again.");
    } finally {
      setDrafting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      {!initial && (
        showDraftPanel ? (
          <div className="flex flex-col gap-3 p-3.5 rounded-sm bg-accent-tint border border-accent/30">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-accent uppercase tracking-wide flex items-center gap-1.5">
                <Sparkles size={13} /> Draft from a real news article
              </p>
              <button type="button" onClick={() => setShowDraftPanel(false)} className="text-xs text-ink-soft hover:text-danger">
                Cancel
              </button>
            </div>
            <p className="text-xs text-ink-soft -mt-1">
              Paste an article's title and summary (e.g. from the farmer-facing Schemes tab, or any real source). The AI only fills in fields the article actually mentions — it leaves benefit/eligibility/where-to-apply blank rather than guess, so check its work before posting.
            </p>
            <Input label="Article title" value={draftArticleTitle} onChange={(e) => setDraftArticleTitle(e.target.value)} placeholder="e.g. Govt announces new fertilizer subsidy for Kharif season" />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink">Article summary / extra context (optional but helps)</label>
              <textarea
                value={draftArticleText}
                onChange={(e) => setDraftArticleText(e.target.value)}
                placeholder="Paste the article snippet, or anything else you know about this scheme..."
                rows={3}
                className="w-full rounded-sm border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:border-primary focus:outline-none transition-colors duration-150 resize-y"
              />
            </div>
            <Input label="Article URL (optional)" value={draftArticleUrl} onChange={(e) => setDraftArticleUrl(e.target.value)} placeholder="https://..." />
            <Button type="button" onClick={handleDraft} disabled={drafting || !draftArticleTitle.trim()}>
              <Sparkles size={16} /> {drafting ? "Drafting..." : "Generate draft"}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowDraftPanel(true)}
            className="self-start flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80"
          >
            <Sparkles size={13} /> Draft from a news article instead of typing from scratch
          </button>
        )
      )}

      <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New PM-KISAN installment released" maxLength={120} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={contentId} className="text-sm font-medium text-ink">Content</label>
        <textarea
          id={contentId}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write the announcement details..."
          rows={4}
          className="w-full rounded-sm border border-border bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-soft/60 focus:border-primary focus:outline-none transition-colors duration-150 resize-y"
        />
      </div>

      {showSchemeFields ? (
        <div className="flex flex-col gap-3 p-3.5 rounded-sm bg-bg border border-border">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-ink-soft uppercase tracking-wide">
              Scheme details (optional) — shown as a quick-reference card to farmers
            </p>
            <button type="button" onClick={() => setShowSchemeFields(false)} className="text-xs text-ink-soft hover:text-danger">
              Remove
            </button>
          </div>
          <Input label="Benefit" value={benefit} onChange={(e) => setBenefit(e.target.value)} placeholder="e.g. ₹6,000/year in 3 installments" />
          <Input label="Eligibility" value={eligibility} onChange={(e) => setEligibility(e.target.value)} placeholder="e.g. Land-owning farmer families" />
          <Input label="Where to apply" value={whereToApply} onChange={(e) => setWhereToApply(e.target.value)} placeholder="e.g. Nearest Common Service Centre / Rythu Seva Kendram" />
          <Input label="Official link (optional)" value={officialLink} onChange={(e) => setOfficialLink(e.target.value)} placeholder="e.g. https://pmkisan.gov.in" />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">Status</label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-sm text-ink cursor-pointer">
                <input type="radio" name="schemeStatus" checked={schemeStatus === "active"} onChange={() => setSchemeStatus("active")} />
                Active
              </label>
              <label className="flex items-center gap-1.5 text-sm text-ink cursor-pointer">
                <input type="radio" name="schemeStatus" checked={schemeStatus === "discontinued"} onChange={() => setSchemeStatus("discontinued")} />
                Discontinued / replaced
              </label>
            </div>
            <p className="text-xs text-ink-soft">
              Discontinued schemes still show to farmers (e.g. "replaced by X") instead of just disappearing — mention the replacement in the content above.
            </p>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowSchemeFields(true)}
          className="self-start text-xs font-semibold text-primary hover:text-primary-dark flex items-center gap-1"
        >
          + Add scheme details (benefit, eligibility, where to apply)
        </button>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={imageId} className="text-sm font-medium text-ink">Image (optional)</label>
        {imagePreview ? (
          <div className="relative w-full max-w-xs">
            <img src={imagePreview} alt="" className="w-full rounded-md border border-border object-cover max-h-48" />
            <button type="button" onClick={clearImage} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-ink/70 text-white flex items-center justify-center hover:bg-ink transition-colors duration-150">
              <X size={14} />
            </button>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-md py-6 px-4 text-center cursor-pointer transition-colors duration-150 hover:border-primary hover:bg-primary-tint/40 max-w-xs">
            <ImagePlus size={16} className="text-ink-soft" />
            <span className="text-sm text-ink-soft">Add an image</span>
            <input id={imageId} ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          </label>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={busy || !title.trim() || !content.trim()}>
          <Megaphone size={16} /> {busy ? "Saving..." : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
        )}
      </div>
    </form>
  );
}

// Upload/list/remove ICAR PDFs — these feed directly into the same Pinecone
// index the chat agent's search_farming_documents tool searches, so
// whatever's uploaded here is immediately usable by the chatbot, and
// whatever's removed here stops being findable by it too.
function ICARDocumentsPanel() {
  const fileInputRef = useRef(null);
  const [documents, setDocuments] = useState(null);
  const [error, setError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  function load() {
    setError(false);
    getDocuments()
      .then((d) => setDocuments(d.documents || []))
      .catch(() => setError(true));
  }

  useEffect(load, []);

  async function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== "application/pdf") {
      toast.error("Only PDF files are allowed.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      await ingestDocument(f);
      toast.success("Uploading in the background — this can take a couple of minutes before it shows up below.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed. Try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(doc) {
    const ok = window.confirm(
      `Remove "${doc.filename}"? The chat assistant will no longer be able to reference it in answers.`
    );
    if (!ok) return;

    setDeletingId(doc.id);
    try {
      await deleteDocument(doc.id);
      toast.success("Document removed");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Couldn't remove that document.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Panel className="p-5">
      <h2 className="text-sm font-semibold text-ink flex items-center gap-1.5 mb-1">
        <FileText size={15} className="text-primary" /> ICAR Documents
      </h2>
      <p className="text-xs text-ink-soft mb-4">
        PDFs uploaded here are searchable by the chat assistant when it answers farming questions.
      </p>

      <label
        htmlFor="icar-upload"
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-md py-6 px-4 text-center transition-colors duration-150 ${
          uploading ? "opacity-50 pointer-events-none" : "cursor-pointer hover:border-primary hover:bg-primary-tint/40"
        }`}
      >
        <UploadCloud size={18} className="text-ink-soft" />
        <span className="text-sm font-medium text-ink">{uploading ? "Uploading..." : "Upload ICAR PDF"}</span>
        <input
          id="icar-upload"
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
        />
      </label>

      <div className="mt-4 pt-4 border-t border-border">
        {error ? (
          <ErrorState message="Couldn't load documents." onRetry={load} />
        ) : !documents ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : documents.length === 0 ? (
          <p className="text-sm text-ink-soft text-center py-4">No documents uploaded yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 p-2.5 rounded-sm bg-bg border border-border">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{d.filename}</p>
                  <p className="text-xs text-ink-soft">
                    {d.chunk_count} chunks · {d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString() : "—"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(d)}
                  disabled={deletingId === d.id}
                  className="shrink-0 text-ink-soft hover:text-danger transition-colors duration-150 disabled:opacity-50"
                  aria-label={`Remove ${d.filename}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

export default function Announcements() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState(null);
  const [error, setError] = useState(false);
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  function load() {
    getAnnouncements()
      .then((data) => setAnnouncements(data.announcements || []))
      .catch(() => setError(true));
  }

  useEffect(load, []);

  async function handlePost({ title, content, benefit, eligibility, where_to_apply, official_link, scheme_status, imageFile }) {
    setPosting(true);
    try {
      await postAnnouncement({ title, content, benefit, eligibility, where_to_apply, official_link, scheme_status, posted_by: user?.username || "Admin", imageFile });
      toast.success("Announcement posted");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Couldn't post the announcement. Try again.");
    } finally {
      setPosting(false);
    }
  }

  async function handleSaveEdit(id, { title, content, benefit, eligibility, where_to_apply, official_link, scheme_status, imageFile }) {
    setSavingEdit(true);
    try {
      await editAnnouncement(id, { title, content, benefit, eligibility, where_to_apply, official_link, scheme_status, imageFile });
      toast.success("Announcement updated");
      setEditingId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Couldn't save changes. Try again.");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="p-5 md:p-8 grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Announcements</h1>
          <p className="text-sm text-ink-soft mt-1">Post updates and scheme info visible to all farmers.</p>
        </div>

        <div>
          <h2 className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-2.5">New announcement</h2>
          <Panel className="p-5">
            <AnnouncementForm submitLabel="Post announcement" onSubmit={handlePost} busy={posting} key="new" />
          </Panel>
        </div>

        <div>
          <h2 className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-2.5">Recent</h2>
          {error ? (
            <ErrorState message="Couldn't load announcements." onRetry={load} />
          ) : !announcements ? (
            <div className="flex flex-col gap-2.5">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : announcements.length === 0 ? (
            <EmptyState title="No announcements posted yet." />
          ) : (
            <div className="flex flex-col gap-2.5">
              {announcements.map((a) => (
                <Panel key={a.id} className="p-4">
                  {editingId === a.id ? (
                    <AnnouncementForm
                      initial={a}
                      submitLabel="Save changes"
                      onSubmit={(vals) => handleSaveEdit(a.id, vals)}
                      onCancel={() => setEditingId(null)}
                      busy={savingEdit}
                    />
                  ) : (
                    <div className="flex gap-3.5">
                      {a.image_url && (
                        <img
                          src={a.image_url}
                          alt=""
                          className="w-20 h-20 shrink-0 rounded-sm border border-border object-cover"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-semibold text-ink leading-snug">{a.title}</h3>
                          <div className="flex items-center gap-2 shrink-0">
                            {a.benefit && (
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary-tint px-1.5 py-0.5 rounded-sm">
                                Scheme
                              </span>
                            )}
                            {a.status === "discontinued" && (
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft bg-border/60 px-1.5 py-0.5 rounded-sm">
                                Discontinued
                              </span>
                            )}
                            {a.updated_at && (
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-accent bg-accent-tint px-1.5 py-0.5 rounded-sm">
                                Edited
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditingId(a.id)}
                              className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-dark transition-colors duration-150"
                            >
                              <Pencil size={12} /> Edit
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-ink-soft mt-1 line-clamp-2">{a.content}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-ink-soft">
                          {a.posted_by && <span>Posted by {a.posted_by}</span>}
                          {a.created_at && <span>{new Date(a.created_at).toLocaleDateString()}</span>}
                          {a.updated_at && <span>· edited {new Date(a.updated_at).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </Panel>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="lg:sticky lg:top-8">
        <h2 className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-2.5">Knowledge base</h2>
        <ICARDocumentsPanel />
      </div>
    </div>
  );
}