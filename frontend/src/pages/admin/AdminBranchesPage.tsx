
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import styles from "./AdminBranchesPage.module.css";

type AdminBranch = {
  id: string;
  brandId: string;
  name: string;
  description: string | null;
  address: string;
  city: string;
  province: string;
  country: string;
  starRating: number | null;
  isActive: boolean;
  images: string[];
  amenities: string[];
  policies: string[];
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
  const [reloadKey, setReloadKey] = useState(0);

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
              : "Unable to load hotel branches."
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

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Branches</h1>
          <p>Manage Velora hotel locations and inventory.</p>
        </div>
      </header>

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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
