// Bounded, owner-reviewed SEC identity aliases. Every entry is tied to a
// specific CIK and authoritative filing; this is never fuzzy-name matching.
// Additions require an identity-freshness review and a primary source.
const identities = [
  {
    requested_tickers: ["BIOR"], cik: "0001580063", legal_name: "Biora Therapeutics, Inc.", current_ticker: "BIOR",
    identity_status: "otc", security_type: "common_stock", listing_venue: "OTC Pink", listing_status: "delisted",
    source_url: "https://www.sec.gov/Archives/edgar/data/1580063/000095017024134755/bior-20241210.htm", source_date: "2024-12-10",
    prior_tickers: [],
    seed_filings: [
      { accession: "0001193125-23-122388", form: "10-K", filed: "2023-04-27", reportDate: "2022-12-31", document: "d463897dars.pdf", items: "", description: "Completed 1-for-25 reverse split" },
      { accession: "0000950170-24-114214", form: "8-K", filed: "2024-10-09", reportDate: "2024-10-09", document: "bior-20241009.htm", items: "5.03", description: "Completed 1-for-10 reverse split" },
      { accession: "0001193125-24-246602", form: "8-K", filed: "2024-10-29", reportDate: "2024-10-28", document: "d899591d8k.htm", items: "1.01", description: "Registered direct offering and warrants" },
      { accession: "0000950170-24-134755", form: "8-K", filed: "2024-12-10", reportDate: "2024-12-09", document: "bior-20241210.htm", items: "3.01", description: "Nasdaq delisting and OTC Pink continuation" }
    ]
  },
  {
    requested_tickers: ["MULN"], cik: "0001499961", legal_name: "Bollinger Innovations, Inc.", current_ticker: "BINI",
    identity_status: "renamed", security_type: "common_stock", listing_venue: "Nasdaq Capital Market", listing_status: "unknown",
    source_url: "https://www.sec.gov/Archives/edgar/data/1499961/000182912625005459/bollingerinnovations_8k.htm", source_date: "2025-07-28",
    prior_tickers: [{ ticker: "MULN", name: "Mullen Automotive Inc.", effective_to: "2025-07-27" }],
    seed_filings: [
      { accession: "0001437749-24-026065", form: "10-Q", filed: "2024-08-14", reportDate: "2024-06-30", document: "muln20240630c_10q.htm", items: "", description: "Completed 2023 reverse-split history" },
      { accession: "0001829126-24-006389", form: "8-K", filed: "2024-09-20", reportDate: "2024-09-16", document: "mullenautomotive_8k.htm", items: "3.01 5.03", description: "Completed September 2024 reverse split and listing notice" },
      { accession: "0001829126-25-004146", form: "8-K", filed: "2025-05-29", reportDate: "2025-05-29", document: "mullenautomotive_ex99-1.htm", items: "5.03", description: "Completed June 2025 reverse split" },
      { accession: "0001829126-25-005459", form: "8-K", filed: "2025-07-28", reportDate: "2025-07-24", document: "bollingerinnovations_8k.htm", items: "5.03", description: "MULN to BINI name and ticker change" }
    ]
  },
  {
    requested_tickers: ["TUPBQ", "TUP"], cik: "0001008654", legal_name: "Tupperware Brands Corporation", current_ticker: "TUPBQ",
    identity_status: "otc", security_type: "common_stock", listing_venue: "OTC Expert Market", listing_status: "delisted",
    source_url: "https://www.sec.gov/Archives/edgar/data/1008654/000100865424000073/tup-20240923.htm", source_date: "2024-09-23",
    prior_tickers: [{ ticker: "TUP", name: "Tupperware Brands Corporation", effective_to: "2024-09-18" }],
    seed_filings: [
      { accession: "0001008654-23-000079", form: "10-K", filed: "2023-10-13", reportDate: "2022-12-31", document: "tup-20221231.htm", items: "", description: "Going-concern disclosure" },
      { accession: "0001008654-24-000068", form: "8-K", filed: "2024-09-18", reportDate: "2024-09-17", document: "tup-20240917.htm", items: "1.03 7.01 9.01", description: "Chapter 11 bankruptcy" },
      { accession: "0001008654-24-000073", form: "8-K", filed: "2024-09-23", reportDate: "2024-09-18", document: "tup-20240923.htm", items: "3.01", description: "NYSE delisting and TUPBQ OTC transition" }
    ]
  }
];

export function resolveBoundedHistoricalIdentity(ticker) {
  const normalized = String(ticker ?? "").trim().toUpperCase();
  const entry = identities.find((item) => item.requested_tickers.includes(normalized));
  return entry ? structuredClone(entry) : null;
}

export function historicalIdentityRegistry() {
  return structuredClone(identities);
}
