import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../lib/api";
import Navbar from "../components/Navbar";
import HotelCard from "../components/HotelCard";
import type { HotelBranch } from "../components/HotelCard";
import styles from "./HomePage.module.css";
import { ArrowRight, Search } from "lucide-react";

type BranchResponse = {
  success: boolean;
  data: HotelBranch[];
};

export default function HomePage() {
  const [branches, setBranches] = useState<HotelBranch[]>([]);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hotelsRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let active = true;

    async function loadBranches() {
      try {
        const response = await apiRequest<BranchResponse>(
          "/branches"
        );

        if (!response.success || !Array.isArray(response.data)) {
          throw new Error("Invalid hotel listing response");
        }

        if (active) {
          setBranches(
            response.data.filter((branch) => branch.isActive)
          );
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load hotels"
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
  }, []);

  const query = submittedSearch.trim().toLowerCase();

  const filteredBranches = branches.filter((branch) =>
    [branch.name, branch.city, branch.province].some((value) =>
      value.toLowerCase().includes(query)
    )
  );

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmittedSearch(search.trim());

    hotelsRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div className={styles.page}>
      <Navbar />

      <main>
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>
              WELCOME TO VELORA HOTELS
            </p>

            <h1 className={styles.heroTitle}>
              Find your next
              <br />
              extraordinary stay.
            </h1>

            <p className={styles.heroDescription}>
              Discover thoughtfully selected accommodation
              across our hotel destinations.
            </p>

            <form
              className={styles.searchBar}
              onSubmit={handleSearch}
              role="search"
            >
              <label
                htmlFor="hotel-search"
                className={styles.visuallyHidden}
              >
                Search hotels by name or city
              </label>

              <div className={styles.searchInputGroup}>
                <Search
                  className={styles.searchIcon}
                  size={26}
                  strokeWidth={2}
                  aria-hidden="true"
                />

                <input
                  id="hotel-search"
                  type="search"
                  autoComplete="off"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search for a hotel, branch or city (e.g. Cape Town, Sandton, Umhlanga)"
                  className={styles.searchInput}
                />
              </div>

              <button
                type="submit"
                className={styles.searchButton}
              >
                Search stays
              </button>
            </form>
          </div>
        </section>

        <section
          id="hotels"
          ref={hotelsRef}
          className={styles.hotels}
        >
          <div className={styles.sectionHeading}>
            <h2>
              {query
                ? "Search results"
                : "Explore our branches"}
            </h2>

            <button
              type="button"
              className={styles.viewAllLink}
              onClick={() => {
                setSearch("");
                setSubmittedSearch("");
                hotelsRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }}
            >
              View all branches
              <ArrowRight
                size={17}
                strokeWidth={2}
                aria-hidden="true"
              />
            </button>
          </div>

          {query && (
            <p className={styles.resultsDescription}>
              Showing branches matching "{submittedSearch}"
            </p>
          )}

          {loading && (
            <p role="status">Loading hotels...</p>
          )}

          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}

          {!loading && !error && (
            filteredBranches.length === 0 ? (
              <p role="status">
                No hotels match your search.
              </p>
            ) : (
              <div className={styles.hotelGrid}>
                {filteredBranches.map((branch) => (
                  <HotelCard
                    key={branch.id}
                    branch={branch}
                  />
                ))}
              </div>
            )
          )}
        </section>
      </main>

      <footer className={styles.footer}>
        <strong>VELORA HOTELS</strong>
        <p>Discover exceptional stays.</p>
      </footer>
    </div>
  );
}
