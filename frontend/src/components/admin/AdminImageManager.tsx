import { useState, type ChangeEvent } from "react";
import { apiRequest } from "../../lib/api";
import styles from "./AdminImageManager.module.css";

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

  async function handleUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    if (!file || uploading) return;

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
            disabled={uploading}
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
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}