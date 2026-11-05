
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import styles from "./AdminRoomsPage.module.css";

type AdminPayment = {
  id: string;
  bookingId: string;
  reference: string;
  amount: string;
  currency: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  booking: {
    id: string;
    status: string;
    checkIn: string;
    checkOut: string;
    user: {
      name: string;
      email: string;
    } | null;
    bookingRooms: {
      room: {
        roomNumber: string;
        branch: {
          id: string;
          name: string;
          city: string;
        };
      };
    }[];
  };
};

type PaymentsResponse = {
  success: boolean;
  data: AdminPayment[];
};

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadPayments() {
      setLoading(true);
      setError("");

      try {
        const response = await apiRequest<PaymentsResponse>(
          "/admin/payments"
        );

        if (!response.success || !Array.isArray(response.data)) {
          throw new Error("Unexpected payments response.");
        }

        if (active) {
          setPayments(response.data);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load payments."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadPayments();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const branches = Array.from(
    new Map(
      payments.flatMap((payment) =>
        payment.booking.bookingRooms.map(({ room }) => [
          room.branch.id,
          room.branch,
        ] as const)
      )
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const filteredPayments = payments.filter((payment) => {
    const matchesStatus =
      statusFilter === "all" ||
      payment.status === statusFilter;

    const matchesBranch =
      branchFilter === "all" ||
      payment.booking.bookingRooms.some(
        ({ room }) => room.branch.id === branchFilter
      );

    return matchesStatus && matchesBranch;
  });

  const statistics = [
    { label: "Total Payments", value: payments.length },
    {
      label: "Pending",
      value: payments.filter((p) => p.status === "PENDING").length,
    },
    {
      label: "Completed",
      value: payments.filter((p) => p.status === "COMPLETED").length,
    },
    {
      label: "Failed",
      value: payments.filter((p) => p.status === "FAILED").length,
    },
  ];

  const statuses = Array.from(
    new Set(payments.map((payment) => payment.status))
  ).sort();

  function formatAmount(payment: AdminPayment) {
    const amount = Number(payment.amount);

    if (!Number.isFinite(amount)) {
      return "Unavailable";
    }

    try {
      return new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: payment.currency,
      }).format(amount);
    } catch {
      return `${payment.currency} ${amount.toFixed(2)}`;
    }
  }

  function formatDate(value: string | null) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Unavailable";
    }

    return date.toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Payments</h1>
          <p>
            Monitor payment transactions across Velora hotel
            branches.
          </p>
        </div>

        <button
          type="button"
          className={styles.addButton}
          disabled={loading}
          onClick={() => setReloadKey((value) => value + 1)}
        >
          Refresh Payments
        </button>
      </header>

      {loading && (
        <p role="status" className={styles.message}>
          Loading payments...
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
            aria-label="Payment statistics"
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

          <section className={styles.roomsSection}>
            <div className={styles.sectionHeader}>
              <h2>Payment Directory</h2>
              <span>{filteredPayments.length} payments shown</span>
            </div>

            <div className={styles.filters}>
              <label>
                <span>Hotel Branch</span>
                <select
                  value={branchFilter}
                  onChange={(event) =>
                    setBranchFilter(event.target.value)
                  }
                >
                  <option value="all">All Branches</option>

                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Payment Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value)
                  }
                >
                  <option value="all">All Statuses</option>

                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {filteredPayments.length === 0 ? (
              <p className={styles.message}>
                No payments found for the selected filters.
              </p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Reference</th>
                      <th scope="col">Guest</th>
                      <th scope="col">Branch</th>
                      <th scope="col">Booking</th>
                      <th scope="col">Amount</th>
                      <th scope="col">Status</th>
                      <th scope="col">Created</th>
                      <th scope="col">Paid</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredPayments.map((payment) => (
                      <tr key={payment.id}>
                        <td className={styles.roomNumber}>
                          {payment.reference}
                        </td>

                        <td>
                          {payment.booking.user?.name || "Guest"}
                          <span className={styles.subText}>
                            {payment.booking.user?.email ||
                              "No email available"}
                          </span>
                        </td>

                        <td>
                          {Array.from(
                            new Set(
                              payment.booking.bookingRooms.map(
                                ({ room }) => room.branch.name
                              )
                            )
                          ).join(", ") || "Unavailable"}
                        </td>

                        <td>
                          {payment.bookingId.slice(0, 8)}
                          <span className={styles.subText}>
                            {payment.booking.status}
                          </span>
                        </td>

                        <td>{formatAmount(payment)}</td>

                        <td>
                          <span
                            className={`${styles.status} ${
                              payment.status === "COMPLETED"
                                ? styles.active
                                : styles.inactive
                            }`}
                          >
                            {payment.status}
                          </span>
                        </td>

                        <td>{formatDate(payment.createdAt)}</td>
                        <td>{formatDate(payment.paidAt)}</td>
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
