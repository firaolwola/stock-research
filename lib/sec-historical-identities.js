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
    identity_status: "renamed", security_type: "common_stock", listing_venue: "OTCID", listing_status: "delisted",
    source_url: "https://www.sec.gov/Archives/edgar/data/1499961/000182912625008053/bollingerinnovations_8k.htm", source_date: "2025-10-10",
    current_ticker_effective_from: "2025-07-28", listing_effective_from: "2025-10-13",
    prior_tickers: [{ ticker: "MULN", name: "Mullen Automotive Inc.", effective_from: "2021-11-12", effective_to: "2025-07-27" }],
    seed_filings: [
      { accession: "0001437749-24-026065", form: "10-Q", filed: "2024-08-14", reportDate: "2024-06-30", document: "muln20240630c_10q.htm", items: "", description: "Completed 2023 reverse-split history" },
      { accession: "0001829126-24-006389", form: "8-K", filed: "2024-09-20", reportDate: "2024-09-16", document: "mullenautomotive_8k.htm", items: "3.01 5.03", description: "Completed September 2024 reverse split and listing notice" },
      { accession: "0001829126-25-004146", form: "8-K", filed: "2025-05-29", reportDate: "2025-05-29", document: "mullenautomotive_ex99-1.htm", items: "5.03", description: "Completed June 2025 reverse split" },
      { accession: "0001829126-25-005459", form: "8-K", filed: "2025-07-28", reportDate: "2025-07-24", document: "bollingerinnovations_8k.htm", items: "5.03", description: "MULN to BINI name and ticker change" },
      { accession: "0001829126-25-008053", form: "8-K", filed: "2025-10-10", reportDate: "2025-10-10", document: "bollingerinnovations_8k.htm", items: "3.01", description: "Nasdaq delisting and BINI OTCID transition" }
    ]
  },
  {
    requested_tickers: ["TUPBQ", "TUP"], cik: "0001008654", legal_name: "Tupperware Brands Corporation", current_ticker: "TUPBQ",
    identity_status: "otc", security_type: "common_stock", listing_venue: "OTC Expert Market", listing_status: "delisted",
    source_url: "https://www.sec.gov/Archives/edgar/data/1008654/000100865424000068/tup-20240917.htm", source_date: "2024-09-18",
    current_ticker_effective_from: "2024-09-19", listing_effective_from: "2024-09-19",
    prior_tickers: [{ ticker: "TUP", name: "Tupperware Brands Corporation", effective_from: "1996-05-31", effective_to: "2024-09-18" }],
    seed_filings: [
      { accession: "0001008654-23-000079", form: "10-K", filed: "2023-10-13", reportDate: "2022-12-31", document: "tup-20221231.htm", items: "", description: "Going-concern disclosure" },
      { accession: "0001008654-24-000068", form: "8-K", filed: "2024-09-18", reportDate: "2024-09-17", document: "tup-20240917.htm", items: "1.03 7.01 9.01", description: "Chapter 11 bankruptcy" },
      { accession: "0001008654-24-000068", form: "8-K", filed: "2024-09-18", reportDate: "2024-09-17", document: "tup-20240917.htm", items: "1.03 3.01 7.01 9.01", description: "Chapter 11, NYSE delisting, and TUPBQ OTC transition" }
    ]
  },
  {
    requested_tickers: ["ZAPPF"], cik: "0001955104", legal_name: "Zapp Electric Vehicles Group Limited", current_ticker: "ZAPPF",
    identity_status: "otc", security_type: "foreign_ordinary_share", listing_venue: "OTC", listing_status: "delisted",
    source_url: "https://www.sec.gov/Archives/edgar/data/1955104/000095017025073965/final_nasdaq_delisting_6.htm", source_date: "2025-05-20",
    listing_effective_from: "2025-05-20",
    filer_jurisdiction: "Cayman Islands", filer_regime: "foreign_private_issuer", accounting_standard: "IFRS",
    prior_tickers: [{ ticker: "ZAPP", name: "Zapp Electric Vehicles Group Limited", effective_from: "2023-04-28", effective_to: "2025-05-19" }],
    seed_filings: [
      { accession: "0000950170-24-044773", form: "6-K", filed: "2024-04-15", reportDate: "2024-04-15", document: "zapp-ex99_1.htm", items: "", description: "Completed 1-for-20 reverse split" },
      { accession: "0000950170-25-011073", form: "20-F", filed: "2025-02-07", reportDate: "2024-09-30", document: "zapp-20240930.htm", items: "", description: "IFRS annual report and going-concern evidence" },
      { accession: "0000950170-25-073965", form: "6-K", filed: "2025-05-20", reportDate: "2025-05-20", document: "final_nasdaq_delisting_6.htm", items: "", description: "Nasdaq suspension, delisting, and OTC transition" },
      { accession: "0001437749-26-002535", form: "NT 20-F", filed: "2026-01-23", reportDate: "2025-09-30", document: "zapp20260122_nt20f.htm", items: "", description: "Late fiscal-2025 annual report" }
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
