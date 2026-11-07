
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import AddBranchForm, {
  type EditableBranch,
} from "../../components/admin/AddBranchForm";
import styles from "./AdminBranchesPage.module.css";
import AdminConfirmModal from "../../components/admin/AdminConfirmModal";
import AdminImageManager from "../../components/admin/AdminImageManager";
import AdminModal from "../../components/admin/AdminModal";

type AdminBranch = EditableBranch & {
  isActive: boolean;
  _count: {
    rooms: number;
    roomTypes: number;
  };
};

type BranchesResponse = {
  success: boolean;
  data: AdminBranch[];
};

export default function AdminBranchesPage() {
  const [branches, setBranches] = useState<AdminBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<AdminBranch | null>(null);
  const [branchFormSaving, setBranchFormSaving] = useState(false);

  const [pendingStatusChange, setPendingStatusChange] = useState<{
    branch: AdminBranch;
    action: "activate" | "deactivate";
  } | null>(null);

  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);

  const [imageBranchId, setImageBranchId] =
  useState<string | null>(null);

  const selectedImageBranch =
    branches.find((branch) => branch.id === imageBranchId) ??
    null;

    const [imageUploading, setImageUploading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadBranches() {
      setLoading(true);
      setError("");

      try {
        const response = await apiRequest<BranchesResponse>(
          "/admin/branches"
        );

        if (!response.success || !Array.isArray(response.data)) {
          throw new Error("Unexpected branch response.");
        }

        if (active) {
          setBranches(response.data);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load branches."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadBranches();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  function handleSaved() {
    setSuccess(
      editingBranch
        ? "Branch updated successfully."
        : "Branch created successfully."
    );

    setShowAddForm(false);
    setEditingBranch(null);
    setReloadKey((value) => value + 1);
  }

  function closeBranchForm() {
    if (branchFormSaving) return;

    setShowAddForm(false);
    setEditingBranch(null);
  }

  function openEdit(branch: AdminBranch) {
    setShowAddForm(false);
    setEditingBranch(branch);
    setSuccess("");
    setBranchFormSaving(false);
  }

  function openAdd() {
    setEditingBranch(null);
    setShowAddForm(true);
    setSuccess("");
    setBranchFormSaving(false);
  }

  const activeBranches = branches.filter(
    (branch) => branch.isActive
  ).length;

  const totalRooms = branches.reduce(
    (total, branch) => total + branch._count.rooms,
    0
  );

  const statistics = [
    { label: "Total Branches", value: branches.length },
    { label: "Active Branches", value: activeBranches },
    { label: "Total Rooms", value: totalRooms },
  ];

  const selectedFormBranch = editingBranch;

  


async function handleBranchStatusChange() {
  if (!pendingStatusChange || changingStatusId) return;

  const { branch, action } = pendingStatusChange;

  setChangingStatusId(branch.id);
  setError("");
  setSuccess("");

  try {
    const endpoint =
      action === "activate"
        ? `/admin/branches/${branch.id}/activate`
        : `/admin/branches/${branch.id}`;

    const response = await apiRequest<{
      success: boolean;
      message?: string;
    }>(endpoint, {
      method: action === "activate" ? "PATCH" : "DELETE",
    });

    if (!response.success) {
      throw new Error(
        response.message ||
          `Unable to ${action} branch.`
      );
    }

    setSuccess(
      response.message ||
        `Branch ${action}d successfully.`
    );

    setPendingStatusChange(null);
    setEditingBranch(null);
    setShowAddForm(false);
    setReloadKey((value) => value + 1);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : `Unable to ${action} branch.`
    );

    setPendingStatusChange(null);
  } finally {
    setChangingStatusId(null);
  }
}


  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Branches</h1>
          <p>Manage Velora hotel locations and inventory.</p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          disabled={loading}
          className={styles.addButton}
        >
          + Add Branch
        </button>
      </header>

      {success && (
        <p role="status" className={styles.success}>
          {success}
        </p>
      )}

      {(showAddForm || selectedFormBranch) && (
        <AdminModal
          title={
            selectedFormBranch
              ? "Edit Branch"
              : "Add New Branch"
          }
          subtitle={
            selectedFormBranch
              ? `Update details for ${selectedFormBranch.name}`
              : "Create a new Velora hotel location."
          }
          size="medium"
          onClose={closeBranchForm}
          canClose={!branchFormSaving}
        >
          <AddBranchForm
            key={selectedFormBranch?.id ?? "new-branch"}
            brandId={
              selectedFormBranch?.brandId ??
              branches[0]?.brandId ??
              ""
            }
            branch={selectedFormBranch ?? undefined}
            onCancel={closeBranchForm}
            onSavingChange={setBranchFormSaving}
            onSaved={handleSaved}
          />
        </AdminModal>
      )}

      {selectedImageBranch && (
        <AdminModal
          title="Manage Branch Images"
          subtitle={selectedImageBranch.name}
          size="large"
          canClose={!imageUploading}
          onClose={() => {
            if (!imageUploading) {
              setImageBranchId(null);
            }
          }}
        >
          <AdminImageManager
            key={selectedImageBranch.id}
            targetType="branch"
            targetId={selectedImageBranch.id}
            targetName={selectedImageBranch.name}
            images={selectedImageBranch.images ?? []}
            onImagesChanged={(images) => {
              setBranches((current) =>
                current.map((branch) =>
                  branch.id === selectedImageBranch.id
                    ? { ...branch, images }
                    : branch
                )
              );
            }}
            onUploadingChange={setImageUploading}
          />
        </AdminModal>
      )}

      {loading && (
        <p role="status" className={styles.message}>
          Loading branches...
        </p>
      )}

      {error && (
        <div role="alert" className={styles.error}>
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
          >
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          <section
            className={styles.statistics}
            aria-label="Branch statistics"
          >
            {statistics.map((stat) => (
              <article
                key={stat.label}
                className={styles.statCard}
              >
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </article>
            ))}
          </section>

          <section className={styles.branchesSection}>
            <div className={styles.sectionHeader}>
              <h2>Hotel Branches</h2>
              <span>{branches.length} total</span>
            </div>

            {branches.length === 0 ? (
              <p className={styles.message}>
                No hotel branches have been created yet.
              </p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Branch</th>
                      <th scope="col">Location</th>
                      <th scope="col">Rooms</th>
                      <th scope="col">Room Types</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {branches.map((branch) => (
                      <tr key={branch.id}>
                        <td className={styles.branchName}>
                          {branch.name}
                        </td>

                        <td>
                          {branch.city}, {branch.province}
                        </td>

                        <td>{branch._count.rooms}</td>
                        <td>{branch._count.roomTypes}</td>

                        <td>
                          <span
                            className={`${styles.status} ${
                              branch.isActive
                                ? styles.active
                                : styles.inactive
                            }`}
                          >
                            {branch.isActive
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </td>
                        
                        <td>
                          <div className={styles.actionGroup}>

                              <button
                                type="button"
                                className={styles.editButton}
                                disabled={changingStatusId !== null}
                                onClick={() => {
                                  setImageBranchId(branch.id);
                                  setSuccess("");
                                }}
                                
                              >
                                Manage Images
                              </button>

                            <button
                              type="button"
                              className={styles.editButton}
                              disabled={changingStatusId !== null}
                              onClick={() => openEdit(branch)}
                            >
                              Edit
                            </button>

                            {branch.isActive ? (
                              <button
                                type="button"
                                className={styles.deactivateButton}
                                disabled={changingStatusId !== null}
                                onClick={() =>
                                  setPendingStatusChange({
                                    branch,
                                    action: "deactivate",
                                  })
                                }
                              >
                                {changingStatusId === branch.id
                                  ? "Deactivating..."
                                  : "Deactivate"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={styles.activateButton}
                                disabled={changingStatusId !== null}
                                onClick={() =>
                                  setPendingStatusChange({
                                    branch,
                                    action: "activate",
                                  })
                                }
                              >
                                {changingStatusId === branch.id
                                  ? "Activating..."
                                  : "Activate"}
                              </button>
                            )}
                          </div>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {pendingStatusChange && (
        <AdminConfirmModal
          title={
            pendingStatusChange.action === "activate"
              ? "Activate Branch?"
              : "Deactivate Branch?"
          }
          itemName={pendingStatusChange.branch.name}
          description={
            pendingStatusChange.action === "activate"
              ? "This hotel branch will become active again."
              : "This hotel branch will become inactive and unavailable as an active location."
          }
          notice={
            pendingStatusChange.action === "activate"
              ? "Previously disabled rooms and room types will remain inactive."
              : "Historical records will be preserved. Branches with confirmed reservations that have not checked out cannot be deactivated."
          }
          confirmLabel={
            pendingStatusChange.action === "activate"
              ? "Activate Branch"
              : "Deactivate Branch"
          }
          loading={changingStatusId !== null}
          onConfirm={() => void handleBranchStatusChange()}
          onCancel={() => {
            if (!changingStatusId) {
              setPendingStatusChange(null);
            }
          }}
        />
      )}


    </main>
  );
}
