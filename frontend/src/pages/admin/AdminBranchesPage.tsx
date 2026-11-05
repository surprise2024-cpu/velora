
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import AddBranchForm, {
  type EditableBranch,
} from "../../components/admin/AddBranchForm";
import styles from "./AdminBranchesPage.module.css";
import AdminConfirmModal from "../../components/admin/AdminConfirmModal";

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
  const [editingBranch, setEditingBranch] =
    useState<AdminBranch | null>(null);

  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [branchToDeactivate, setBranchToDeactivate] = useState<AdminBranch | null>(null);
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

  function openEdit(branch: AdminBranch) {
    setShowAddForm(false);
    setEditingBranch(branch);
    setSuccess("");
  }

  function openAdd() {
    setEditingBranch(null);
    setShowAddForm(true);
    setSuccess("");
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

  

async function handleDeactivate() {
  if (!branchToDeactivate || deactivatingId) return;

  const branch = branchToDeactivate;

  setDeactivatingId(branch.id);
  setError("");
  setSuccess("");

  try {
    const response = await apiRequest<{
      success: boolean;
      message?: string;
    }>(`/admin/branches/${branch.id}`, {
      method: "DELETE",
    });

    if (!response.success) {
      throw new Error(
        response.message || "Unable to deactivate branch."
      );
    }

    setSuccess(
      response.message || "Branch deactivated successfully."
    );

    setBranchToDeactivate(null);
    setEditingBranch(null);
    setShowAddForm(false);
    setReloadKey((value) => value + 1);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to deactivate branch."
    );

    setBranchToDeactivate(null);
  } finally {
    setDeactivatingId(null);
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
        <AddBranchForm
          key={selectedFormBranch?.id ?? "new-branch"}
          brandId={
            selectedFormBranch?.brandId ??
            branches[0]?.brandId ??
            ""
          }
          branch={selectedFormBranch ?? undefined}
          onCancel={() => {
            setShowAddForm(false);
            setEditingBranch(null);
          }}
          onSaved={handleSaved}
        />
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
                              onClick={() => openEdit(branch)}
                            >
                              Edit
                            </button>

                            {branch.isActive && (
                              <button
                                type="button"
                                className={styles.deactivateButton}
                                disabled={deactivatingId !== null}
                                onClick={() => setBranchToDeactivate(branch)}
                              >
                                {deactivatingId === branch.id
                                  ? "Deactivating..."
                                  : "Deactivate"}
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

      {branchToDeactivate && (
        <AdminConfirmModal
          title="Deactivate Branch?"
          itemName={branchToDeactivate.name}
          description="Are you sure you want to deactivate this hotel branch? It will no longer be available as an active location."
          confirmLabel="Deactivate Branch"
          loading={deactivatingId !== null}
          onConfirm={() => void handleDeactivate()}
          onCancel={() => {
            if (!deactivatingId) {
              setBranchToDeactivate(null);
            }
          }}
        />
      )}

    </main>
  );
}
