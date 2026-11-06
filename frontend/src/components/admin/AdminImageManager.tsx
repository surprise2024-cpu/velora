import { useState, type ChangeEvent } from "react";
import { apiRequest } from "../../lib/api";
import styles from "./AdminImageManager.module.css";
import AdminConfirmModal from "./AdminConfirmModal";

type TargetType = "branch" | "roomType";

type Props = {
  targetType: TargetType;
  targetId: string;
  targetName: string;
  images: string[];
  onImagesChanged: (images: string[]) => void;
  onUploadingChange?: (uploading: boolean) => void;
};

type UploadResponse = {
  success: boolean;
  message: string;
  data: {
    url: string;
    publicId: string;
    images: string[];
  };
};

export default function AdminImageManager({
  targetType,
  targetId,
  targetName,
  images,
  onImagesChanged,
  onUploadingChange,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savingCover, setSavingCover] = useState(false);
  const [removingImage, setRemovingImage] = useState(false);
  const [pendingRemovalIndex, setPendingRemovalIndex] = useState<number | null>(null);
  
  async function handleSetCover(index: number) {
  if (index === 0 || uploading || savingCover || removingImage) return;

  setError("");
  setSuccess("");
  setSavingCover(true);

  try {
    const updatedImages = [...images];
    const [selectedImage] = updatedImages.splice(index, 1);

    updatedImages.unshift(selectedImage);

    const endpoint =
      targetType === "branch"
        ? `/admin/branches/${targetId}`
        : `/admin/room-types/${targetId}`;

    const response = await apiRequest<{
      success: boolean;
      message?: string;
    }>(endpoint, {
      method: "PATCH",
      body: JSON.stringify({
        images: updatedImages,
      }),
    });

    if (!response.success) {
      throw new Error(
        response.message || "Unable to update cover image."
      );
    }

    onImagesChanged(updatedImages);
    setSuccess("Cover image updated successfully.");
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to update cover image."
    );
  } finally {
    setSavingCover(false);
  }
}

  async function handleRemoveImage(index: number) {
  if (uploading || savingCover || removingImage) return;

  setPendingRemovalIndex(null);

  setError("");
  setSuccess("");
  setRemovingImage(true);

  try {
    const updatedImages = images.filter(
      (_, imageIndex) => imageIndex !== index
    );

    const endpoint =
      targetType === "branch"
        ? `/admin/branches/${targetId}`
        : `/admin/room-types/${targetId}`;

    const response = await apiRequest<{
      success: boolean;
      message?: string;
    }>(endpoint, {
      method: "PATCH",
      body: JSON.stringify({
        images: updatedImages,
      }),
    });

    if (!response.success) {
      throw new Error(
        response.message || "Unable to remove image."
      );
    }

    onImagesChanged(updatedImages);
    setPendingRemovalIndex(null);
    setSuccess("Image removed successfully.");

  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to remove image."
    );
  } finally {
    setRemovingImage(false);
  }
}

  async function handleUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    if (!file || uploading || savingCover || removingImage) return;

    setError("");
    setSuccess("");

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Only JPG, PNG and WebP images are allowed.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must not exceed 5 MB.");
      event.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("image", file);
    formData.append("targetType", targetType);
    formData.append("targetId", targetId);

    setUploading(true);
    onUploadingChange?.(true);

    try {
      const response = await apiRequest<UploadResponse>(
        "/admin/images/assign",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.success) {
        throw new Error(response.message);
      }

      onImagesChanged(response.data.images);
      setSuccess("Image uploaded and assigned successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to upload image."
      );
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
      event.target.value = "";
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <div>
          <strong>{images.length} images</strong>
          <p>The first image is the cover photograph.</p>
        </div>

        <label className={styles.uploadButton}>
          {uploading ? "Uploading..." : "+ Upload Image"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => void handleUpload(event)}
            disabled={uploading || savingCover || removingImage}
            hidden
          />
        </label>
      </div>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      {success && (
        <p role="status" className={styles.success}>
          {success}
        </p>
      )}

      {images.length === 0 ? (
        <p className={styles.empty}>
          No images assigned yet. Upload the first photograph.
        </p>
      ) : (
        <div className={styles.gallery}>
          {images.map((url, index) => (
            <div
              className={styles.imageCard}
              key={`${url}-${index}`}
            >
              <img
                src={url}
                alt={`${targetName} photograph ${index + 1}`}
                loading="lazy"
              />

              <div className={styles.imageFooter}>
                <span>
                  {index === 0
                    ? "Cover image"
                    : `Image ${index + 1}`}
                </span>

                <div className={styles.imageActions}>
                  {index !== 0 && (
                    <button
                      type="button"
                      className={styles.coverButton}
                      disabled={uploading || savingCover || removingImage}
                      onClick={() => void handleSetCover(index)}
                    >
                      {savingCover ? "Saving..." : "Set as Cover"}
                    </button>
                  )}

                  <button
                    type="button"
                    className={styles.removeButton}
                    disabled={uploading || savingCover || removingImage}
                    onClick={() => setPendingRemovalIndex(index)}
                  >
                    {removingImage ? "Removing..." : "Remove"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {pendingRemovalIndex !== null && (
        <AdminConfirmModal
          title="Remove Photograph"
          itemName={`${targetName} — Image ${pendingRemovalIndex + 1}`}
          description={
            pendingRemovalIndex === 0
              ? "This photograph will be removed from the gallery. The next photograph will automatically become the cover."
              : "This photograph will be removed from the gallery."
          }
          notice="The photograph will be unassigned from this listing. The original Cloudinary file will not be permanently deleted."
          confirmLabel="Remove Image"
          cancelLabel="Keep Image"
          loadingLabel="Removing..."
          loading={removingImage}
          onCancel={() => setPendingRemovalIndex(null)}
          onConfirm={() => void handleRemoveImage(pendingRemovalIndex)}
        />
      )}

    </section>
  );
}