
import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import Navbar from "../components/Navbar";
import HotelCard from "../components/HotelCard";
import type { HotelBranch } from "../components/HotelCard";
import styles from "./HomePage.module.css";

type BranchResponse = {
  success: boolean;
  data: HotelBranch[];
};

export default function HomePage() {
  const [branches, setBranches] = useState<HotelBranch[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const query = search.trim().toLowerCase();

  const filteredBranches = branches.filter((branch) =>
    [branch.name, branch.city, branch.province]
      .some((value) => value.toLowerCase().includes(query))
  );

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

            <a href="#hotels" className={styles.heroButton}>
              Explore Our Hotels
            </a>
          </div>
        </section>

        <section id="hotels" className={styles.hotels}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>
                OUR DESTINATIONS
              </p>

              <h2>Discover Velora</h2>

              <p className={styles.sectionDescription}>
                Explore our hotel branches and discover
                your next destination.
              </p>
            </div>

            <label className={styles.searchField}>
              <span>Search destinations</span>

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search hotel or city"
              />
            </label>
          </div>

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
