import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTenant } from "@/lib/tenant-context";
import { supabase } from "@/integrations/supabase/client";
import { Store, Plus, Loader2, MapPin, Edit, Trash2, Building2, CheckCircle2, XCircle, Users, Search, ChevronDown, Phone } from "lucide-react";
import { motion } from "framer-motion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBusinessRealtime } from "@/lib/use-business-realtime";

export const Route = createFileRoute("/t/$slug/stores")({ component: StoresManagement });

type StoreData = {
  id: string;
  name: string;
  location: string | null;
  location_address: string | null;
  location_city: string | null;
  location_county: string | null;
  location_country: string | null;
  location_postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  google_place_id: string | null;
  store_type: string | null;
  active: boolean | null;
  phone: string | null;
  country_code: string | null;
  country_iso: string | null;
  phone_number: string | null;
  full_phone_number: string | null;
  email: string | null;
  manager_name: string | null;
  created_at: string;
  inventory_mode: string | null;
};

type LocationData = {
  location_address: string;
  location_city: string;
  location_county: string;
  location_country: string;
  location_postal_code: string;
  latitude: number | null;
  longitude: number | null;
  google_place_id: string;
};

type CountryOption = {
  iso: string;
  name: string;
  dialCode: string;
};

type StoreFormData = {
  name: string;
  location: string;
  location_address: string;
  location_city: string;
  location_county: string;
  location_country: string;
  location_postal_code: string;
  latitude: number | null;
  longitude: number | null;
  google_place_id: string;
  store_type: string;
  active: boolean;
  phone: string;
  country_code: string;
  country_iso: string;
  phone_number: string;
  full_phone_number: string;
  email: string;
  inventory_mode: string;
};

type FormErrors = Partial<Record<"name" | "location" | "phone", string>>;

declare global {
  interface Window {
    google?: any;
    __googlePlacesPromise?: Promise<void>;
  }
}

const countries: CountryOption[] = [
  { iso: "KE", name: "Kenya", dialCode: "+254" },
  { iso: "UG", name: "Uganda", dialCode: "+256" },
  { iso: "TZ", name: "Tanzania", dialCode: "+255" },
  { iso: "RW", name: "Rwanda", dialCode: "+250" },
  { iso: "ET", name: "Ethiopia", dialCode: "+251" },
  { iso: "NG", name: "Nigeria", dialCode: "+234" },
  { iso: "ZA", name: "South Africa", dialCode: "+27" },
  { iso: "GH", name: "Ghana", dialCode: "+233" },
  { iso: "US", name: "United States", dialCode: "+1" },
  { iso: "CA", name: "Canada", dialCode: "+1" },
  { iso: "GB", name: "United Kingdom", dialCode: "+44" },
  { iso: "IE", name: "Ireland", dialCode: "+353" },
  { iso: "FR", name: "France", dialCode: "+33" },
  { iso: "DE", name: "Germany", dialCode: "+49" },
  { iso: "IT", name: "Italy", dialCode: "+39" },
  { iso: "ES", name: "Spain", dialCode: "+34" },
  { iso: "NL", name: "Netherlands", dialCode: "+31" },
  { iso: "BE", name: "Belgium", dialCode: "+32" },
  { iso: "CH", name: "Switzerland", dialCode: "+41" },
  { iso: "SE", name: "Sweden", dialCode: "+46" },
  { iso: "NO", name: "Norway", dialCode: "+47" },
  { iso: "DK", name: "Denmark", dialCode: "+45" },
  { iso: "FI", name: "Finland", dialCode: "+358" },
  { iso: "PL", name: "Poland", dialCode: "+48" },
  { iso: "PT", name: "Portugal", dialCode: "+351" },
  { iso: "IN", name: "India", dialCode: "+91" },
  { iso: "PK", name: "Pakistan", dialCode: "+92" },
  { iso: "BD", name: "Bangladesh", dialCode: "+880" },
  { iso: "CN", name: "China", dialCode: "+86" },
  { iso: "JP", name: "Japan", dialCode: "+81" },
  { iso: "KR", name: "South Korea", dialCode: "+82" },
  { iso: "SG", name: "Singapore", dialCode: "+65" },
  { iso: "MY", name: "Malaysia", dialCode: "+60" },
  { iso: "ID", name: "Indonesia", dialCode: "+62" },
  { iso: "PH", name: "Philippines", dialCode: "+63" },
  { iso: "TH", name: "Thailand", dialCode: "+66" },
  { iso: "AE", name: "United Arab Emirates", dialCode: "+971" },
  { iso: "SA", name: "Saudi Arabia", dialCode: "+966" },
  { iso: "QA", name: "Qatar", dialCode: "+974" },
  { iso: "AU", name: "Australia", dialCode: "+61" },
  { iso: "NZ", name: "New Zealand", dialCode: "+64" },
  { iso: "BR", name: "Brazil", dialCode: "+55" },
  { iso: "MX", name: "Mexico", dialCode: "+52" },
  { iso: "AR", name: "Argentina", dialCode: "+54" },
  { iso: "CL", name: "Chile", dialCode: "+56" },
  { iso: "CO", name: "Colombia", dialCode: "+57" },
  { iso: "EG", name: "Egypt", dialCode: "+20" },
  { iso: "MA", name: "Morocco", dialCode: "+212" },
  { iso: "TR", name: "Turkey", dialCode: "+90" },
  { iso: "IL", name: "Israel", dialCode: "+972" },
].sort((a, b) => a.name.localeCompare(b.name));

function flagEmoji(iso: string) {
  return iso
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function detectCountry() {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  const iso = locale.split("-").pop()?.toUpperCase();
  return countries.find((country) => country.iso === iso) || countries.find((country) => country.iso === "KE") || countries[0];
}

async function loadAllCountries() {
  const response = await fetch("https://restcountries.com/v3.1/all?fields=cca2,name,idd");
  if (!response.ok) throw new Error("Could not load country list.");
  const rows = await response.json();
  return rows
    .map((row: any) => {
      const suffix = row.idd?.suffixes?.[0] || "";
      const dialCode = row.idd?.root ? `${row.idd.root}${suffix}` : "";
      return {
        iso: row.cca2,
        name: row.name?.common,
        dialCode,
      };
    })
    .filter((country: CountryOption) => country.iso && country.name && country.dialCode)
    .sort((a: CountryOption, b: CountryOption) => a.name.localeCompare(b.name));
}

function emptyStoreForm(inventoryMode = "products"): StoreFormData {
  const country = detectCountry();
  return {
    name: "",
    location: "",
    location_address: "",
    location_city: "",
    location_county: "",
    location_country: "",
    location_postal_code: "",
    latitude: null,
    longitude: null,
    google_place_id: "",
    store_type: "Retail Outlet",
    active: true,
    phone: "",
    country_code: country.dialCode,
    country_iso: country.iso,
    phone_number: "",
    full_phone_number: "",
    email: "",
    inventory_mode: inventoryMode,
  };
}

function componentValue(components: any[] | undefined, type: string) {
  return components?.find((component) => component.types.includes(type))?.long_name || "";
}

function loadGooglePlaces() {
  if (window.google?.maps?.places) return Promise.resolve();
  if (window.__googlePlacesPromise) return window.__googlePlacesPromise;

  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return Promise.reject(new Error("Add VITE_GOOGLE_PLACES_API_KEY to enable address search."));

  window.__googlePlacesPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Places failed to load."));
    document.head.appendChild(script);
  });

  return window.__googlePlacesPromise;
}

function PlacesAutocompleteField({
  value,
  error,
  onChange,
  onSelect,
}: {
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onSelect: (location: LocationData) => void;
}) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const serviceRef = useRef<any>(null);
  const detailsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadGooglePlaces()
      .then(() => {
        serviceRef.current = new window.google.maps.places.AutocompleteService();
        detailsRef.current = document.createElement("div");
        setReady(true);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  useEffect(() => {
    if (!ready || !value.trim()) {
      setSuggestions([]);
      return;
    }

    const timeout = window.setTimeout(() => {
      setLoading(true);
      serviceRef.current.getPlacePredictions(
        {
          input: value,
          types: ["geocode", "establishment"],
        },
        (predictions: any[] | null, status: string) => {
          setLoading(false);
          if (status !== window.google.maps.places.PlacesServiceStatus.OK || !predictions) {
            setSuggestions([]);
            return;
          }
          setSuggestions(predictions.slice(0, 6));
          setActiveIndex(-1);
        },
      );
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [ready, value]);

  function selectSuggestion(prediction: any) {
    if (!detailsRef.current) return;
    setLoading(true);
    const service = new window.google.maps.places.PlacesService(detailsRef.current);
    service.getDetails(
      {
        placeId: prediction.place_id,
        fields: ["address_components", "formatted_address", "geometry", "place_id"],
      },
      (place: any, status: string) => {
        setLoading(false);
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !place) {
          setLoadError("Could not load location details. Please try another result.");
          return;
        }

        const city =
          componentValue(place.address_components, "locality") ||
          componentValue(place.address_components, "postal_town") ||
          componentValue(place.address_components, "administrative_area_level_2");
        const county = componentValue(place.address_components, "administrative_area_level_1");
        const country = componentValue(place.address_components, "country");
        const postalCode = componentValue(place.address_components, "postal_code");
        const formatted = place.formatted_address || prediction.description;

        onSelect({
          location_address: formatted,
          location_city: city,
          location_county: county,
          location_country: country,
          location_postal_code: postalCode,
          latitude: place.geometry?.location?.lat?.() ?? null,
          longitude: place.geometry?.location?.lng?.() ?? null,
          google_place_id: place.place_id || prediction.place_id,
        });
        setSuggestions([]);
      },
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!suggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setSuggestions([]);
    }
  }

  return (
    <div className="space-y-2">
      <Label>Location / Address <span className="text-red-500">*</span></Label>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a location or search Google Places"
          className="pl-10 pr-10 rounded-2xl bg-background/80 backdrop-blur"
          aria-invalid={Boolean(error || loadError)}
          aria-autocomplete="list"
        />
        {loading ? <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" /> : null}
        {suggestions.length ? (
          <div className="absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-border/70 bg-popover/95 p-2 shadow-xl backdrop-blur">
            {suggestions.map((suggestion, index) => (
              <button
                type="button"
                key={suggestion.place_id}
                onMouseDown={() => selectSuggestion(suggestion)}
                className={`flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition ${index === activeIndex ? "bg-primary/10" : "hover:bg-muted"}`}
              >
                <Search className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span>
                  <span className="block text-sm font-medium">{suggestion.structured_formatting?.main_text || suggestion.description}</span>
                  <span className="block text-xs text-muted-foreground">{suggestion.structured_formatting?.secondary_text || "Google Places"}</span>
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {loadError ? <p className="text-xs text-destructive">{loadError}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function InternationalPhoneInput({
  countryIso,
  localNumber,
  error,
  onChange,
}: {
  countryIso: string;
  localNumber: string;
  error?: string;
  onChange: (country: CountryOption, localNumber: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [phoneCountries, setPhoneCountries] = useState(countries);

  useEffect(() => {
    loadAllCountries()
      .then((items) => {
        if (items.length) setPhoneCountries(items);
      })
      .catch(() => undefined);
  }, []);

  const selected = phoneCountries.find((country) => country.iso === countryIso) || detectCountry();
  const filteredCountries = phoneCountries.filter((country) => {
    const search = `${country.name} ${country.iso} ${country.dialCode}`.toLowerCase();
    return search.includes(query.toLowerCase());
  });

  function setNumber(value: string) {
    const digits = value.replace(/\D/g, "").replace(/^0+/, "");
    onChange(selected, digits);
  }

  return (
    <div className="space-y-2">
      <Label>Phone Number <span className="text-red-500">*</span></Label>
      <div className="relative flex rounded-2xl border border-input bg-background/80 shadow-sm backdrop-blur focus-within:ring-2 focus-within:ring-ring">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex min-w-[118px] items-center gap-2 rounded-l-2xl border-r border-border px-3 text-sm"
        >
          <span className="text-lg">{flagEmoji(selected.iso)}</span>
          <span className="font-medium">{selected.dialCode}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <div className="relative flex-1">
          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={localNumber}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="712345678"
            inputMode="tel"
            className="h-10 w-full rounded-r-2xl bg-transparent px-3 pl-10 text-sm outline-none placeholder:text-muted-foreground"
            aria-invalid={Boolean(error)}
          />
        </div>
        {open ? (
          <div className="absolute left-0 top-12 z-50 w-full overflow-hidden rounded-2xl border border-border/70 bg-popover/95 shadow-xl backdrop-blur md:w-[380px]">
            <div className="border-b border-border p-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country or code"
                className="rounded-xl"
              />
            </div>
            <div className="max-h-64 overflow-auto p-2">
              {filteredCountries.map((country) => (
                <button
                  type="button"
                  key={country.iso}
                  onClick={() => {
                    onChange(country, localNumber);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="text-lg">{flagEmoji(country.iso)}</span>
                  <span className="flex-1">{country.name}</span>
                  <span className="font-medium text-muted-foreground">{country.dialCode}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {localNumber ? <p className="text-xs text-muted-foreground">Stored as {selected.dialCode}{localNumber}</p> : null}
    </div>
  );
}

function StoresManagement() {
  const { business, role } = useTenant();
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<StoreData[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newStore, setNewStore] = useState<StoreFormData>(() => emptyStoreForm("products"));
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (business) loadStores();
  }, [business]);

  useBusinessRealtime(business?.id, ["stores", "employees"], loadStores);

  async function loadStores() {
    if (!business) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("business_id", business.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setStores(data || []);
    } catch (e: any) {
      toast.error("Failed to load stores: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  function updatePhone(country: CountryOption, localNumber: string) {
    setNewStore({
      ...newStore,
      country_code: country.dialCode,
      country_iso: country.iso,
      phone_number: localNumber,
      full_phone_number: localNumber ? `${country.dialCode}${localNumber}` : "",
      phone: localNumber ? `${country.dialCode}${localNumber}` : "",
    });
    if (formErrors.phone) setFormErrors({ ...formErrors, phone: undefined });
  }

  function validateStoreForm() {
    const errors: FormErrors = {};
    if (!newStore.name.trim()) errors.name = "Store name is required.";
    if (!newStore.location_address.trim()) errors.location = "Location is required.";
    if (!newStore.phone_number.trim()) errors.phone = "Phone number is required.";
    if (newStore.phone_number && (newStore.phone_number.length < 6 || newStore.phone_number.length > 15)) {
      errors.phone = "Enter a valid phone number for the selected country.";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSaveStore(e: React.FormEvent) {
    e.preventDefault();
    if (!business || saving || !validateStoreForm()) return;

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("stores")
          .update({ 
            name: newStore.name, 
            location: newStore.location_address,
            location_address: newStore.location_address,
            location_city: newStore.location_city,
            location_county: newStore.location_county,
            location_country: newStore.location_country,
            location_postal_code: newStore.location_postal_code,
            latitude: newStore.latitude,
            longitude: newStore.longitude,
            google_place_id: newStore.google_place_id,
            store_type: newStore.store_type,
            active: newStore.active,
            phone: newStore.full_phone_number,
            country_code: newStore.country_code,
            country_iso: newStore.country_iso,
            phone_number: newStore.phone_number,
            full_phone_number: newStore.full_phone_number,
            email: newStore.email,
            inventory_mode: newStore.inventory_mode
          })
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Store updated");
      } else {
        const { error } = await supabase
          .from("stores")
          .insert({
            business_id: business.id,
            name: newStore.name,
            location: newStore.location_address,
            location_address: newStore.location_address,
            location_city: newStore.location_city,
            location_county: newStore.location_county,
            location_country: newStore.location_country,
            location_postal_code: newStore.location_postal_code,
            latitude: newStore.latitude,
            longitude: newStore.longitude,
            google_place_id: newStore.google_place_id,
            store_type: newStore.store_type,
            active: newStore.active,
            phone: newStore.full_phone_number,
            country_code: newStore.country_code,
            country_iso: newStore.country_iso,
            phone_number: newStore.phone_number,
            full_phone_number: newStore.full_phone_number,
            email: newStore.email,
            inventory_mode: newStore.inventory_mode
          });
        if (error) throw error;
        toast.success("Store added");
      }
      setIsAddOpen(false);
      setNewStore(emptyStoreForm(business?.inventory_mode || "products"));
      setFormErrors({});
      setEditingId(null);
      loadStores();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(store: StoreData) {
    const country = countries.find((item) => item.iso === store.country_iso) || detectCountry();
    setEditingId(store.id);
    setNewStore({ 
      name: store.name, 
      location: store.location_address || store.location || "",
      location_address: store.location_address || store.location || "",
      location_city: store.location_city || "",
      location_county: store.location_county || "",
      location_country: store.location_country || "",
      location_postal_code: store.location_postal_code || "",
      latitude: store.latitude,
      longitude: store.longitude,
      google_place_id: store.google_place_id || "",
      store_type: store.store_type || "Retail Outlet",
      active: store.active ?? true,
      phone: store.full_phone_number || store.phone || "",
      country_code: store.country_code || country.dialCode,
      country_iso: store.country_iso || country.iso,
      phone_number: store.phone_number || "",
      full_phone_number: store.full_phone_number || store.phone || "",
      email: store.email || "",
      inventory_mode: store.inventory_mode || "products",
    });
    setFormErrors({});
    setIsAddOpen(true);
  }

  async function deleteStore(id: string) {
    if (!confirm("Are you sure you want to delete this store? All associated data might be affected.")) return;
    try {
      const { error } = await supabase.from("stores").delete().eq("id", id);
      if (error) throw error;
      toast.success("Store deleted");
      loadStores();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (!business) return null;
  const activeStores = stores.filter(s => s.active !== false).length;
  const inactiveStores = stores.length - activeStores;
  const managedStores = stores.filter(s => s.manager_name).length;

  return (
    <div className="w-full p-4 md:p-8 space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 md:p-8 shadow-sm">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary/20 via-emerald-500/10 to-transparent" />
        <div className="relative flex flex-col md:flex-row justify-between md:items-end gap-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Store className="h-3.5 w-3.5" /> Branch operations
            </div>
            <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">Stores Management</h1>
            <p className="mt-2 text-sm text-muted-foreground">Manage branches, store contacts, managers, and operating status.</p>
          </div>
        
        {role === "owner" && (
          <Dialog open={isAddOpen} onOpenChange={(open) => {
            setIsAddOpen(open);
            if (!open) {
              setNewStore(emptyStoreForm(business?.inventory_mode || "products"));
              setFormErrors({});
              setEditingId(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button className="gradient-violet gap-2">
                <Plus className="h-4 w-4" /> Add Store
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl border-border/70 bg-background/95 shadow-2xl backdrop-blur sm:max-w-[700px]">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Store" : "Add New Store"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveStore} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Left Column: Basic Info */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground border-b border-border/50 pb-2">General Info</h3>
                    
                    <div className="space-y-2">
                      <Label>Store Name <span className="text-red-500">*</span></Label>
                      <Input required value={newStore.name} onChange={e => setNewStore({...newStore, name: e.target.value})} placeholder="e.g. Downtown Branch" className="rounded-2xl bg-background/80 backdrop-blur" />
                      {formErrors.name ? <p className="text-xs text-destructive">{formErrors.name}</p> : null}
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Store Type</Label>
                      <select
                        className="flex h-10 w-full rounded-2xl border border-input bg-background/80 px-3 py-2 text-sm shadow-sm backdrop-blur ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={newStore.store_type}
                        onChange={e => setNewStore({...newStore, store_type: e.target.value})}
                      >
                        <option value="Retail Outlet">Retail Outlet</option>
                        <option value="Wholesale">Wholesale</option>
                        <option value="Warehouse/Store">Warehouse/Store</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label>Inventory Mode</Label>
                      <select
                        className="flex h-10 w-full rounded-2xl border border-input bg-background/80 px-3 py-2 text-sm shadow-sm backdrop-blur ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={newStore.inventory_mode}
                        onChange={e => setNewStore({...newStore, inventory_mode: e.target.value})}
                      >
                        <option value="products">Products only (Requires stock tracking)</option>
                        <option value="services">Services only (No stock tracking)</option>
                        <option value="both">Both Products and Services</option>
                      </select>
                    </div>
                    
                    <div className="flex items-center space-x-2 pt-2">
                      <input 
                        id="active-status" 
                        type="checkbox" 
                        className="h-4 w-4 rounded-md border-border cursor-pointer"
                        checked={newStore.active} 
                        onChange={e => setNewStore({...newStore, active: e.target.checked})} 
                      />
                      <Label htmlFor="active-status" className="cursor-pointer font-medium">Status (Active/Inactive)</Label>
                    </div>
                  </div>

                  {/* Right Column: Contact & Location */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground border-b border-border/50 pb-2">Contact Details</h3>
                    
                    <PlacesAutocompleteField
                      value={newStore.location_address}
                      error={formErrors.location}
                      onChange={(value) => {
                        setNewStore({
                          ...newStore,
                          location: value,
                          location_address: value,
                          google_place_id: "",
                          latitude: null,
                          longitude: null,
                        });
                        if (formErrors.location) setFormErrors({ ...formErrors, location: undefined });
                      }}
                      onSelect={(location) => {
                        setNewStore({
                          ...newStore,
                          ...location,
                          location: location.location_address,
                        });
                        if (formErrors.location) setFormErrors({ ...formErrors, location: undefined });
                      }}
                    />
                    
                    <InternationalPhoneInput
                      countryIso={newStore.country_iso}
                      localNumber={newStore.phone_number}
                      error={formErrors.phone}
                      onChange={updatePhone}
                    />
                    
                    <div className="space-y-2">
                      <Label>Branch Email</Label>
                      <Input type="email" value={newStore.email} onChange={e => setNewStore({...newStore, email: e.target.value})} placeholder="e.g. branch@example.com" className="rounded-2xl bg-background/80 backdrop-blur" />
                    </div>
                    
                  </div>
                  
                </div>
                
                <Button type="submit" className="w-full rounded-2xl bg-[#00a699] hover:bg-[#008c82] text-white mt-2 border-0 shadow-sm" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {saving ? "Saving Store..." : "Save Store"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "Total stores", value: String(stores.length), helper: "Branches configured", icon: Building2, tone: "from-primary/25 to-primary/5" },
          { label: "Active", value: String(activeStores), helper: "Currently operating", icon: CheckCircle2, tone: "from-emerald-500/25 to-emerald-500/5" },
          { label: "Inactive", value: String(inactiveStores), helper: "Paused locations", icon: XCircle, tone: "from-rose-500/25 to-rose-500/5" },
          { label: "Managed", value: `${managedStores}/${stores.length}`, helper: "Have assigned managers", icon: Users, tone: "from-amber-500/25 to-amber-500/5" },
        ].map(card => (
          <div key={card.label} className={`rounded-2xl border border-border/50 bg-gradient-to-br ${card.tone} p-5 shadow-sm`}>
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{card.label}</span><card.icon className="h-5 w-5 text-primary" /></div>
            <div className="mt-4 text-2xl font-bold truncate">{card.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{card.helper}</div>
          </div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 shadow-sm border border-border/60">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Store className="h-4 w-4 text-white" />
          </div>
          <div><div className="font-medium">All Stores</div><div className="text-xs text-muted-foreground">Review branch health and update operational details.</div></div>
        </div>
        
        <div className="rounded-xl border border-border bg-background/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Store Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Status</TableHead>
                {role === "owner" && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1, 2].map(i => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-4 w-48 bg-muted animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded"></div></TableCell>
                    {role === "owner" && <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto"></div></TableCell>}
                  </TableRow>
                ))
              ) : stores.length === 0 ? (
                 <TableRow>
                   <TableCell colSpan={role === "owner" ? 5 : 4} className="text-center py-8 text-muted-foreground">No stores found. Add your first store above.</TableCell>
                 </TableRow>
              ) : (
                stores.map(store => (
                  <TableRow key={store.id} className="group">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-muted-foreground" />
                        {store.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {store.location || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{store.manager_name || "Unassigned"}</TableCell>
                    <TableCell>
                      <span className={`text-[10px] uppercase tracking-wider font-bold rounded-full px-2 py-1 ${store.active === false ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>{store.active === false ? "Inactive" : "Active"}</span>
                    </TableCell>
                    {role === "owner" && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(store)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => deleteStore(store.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </motion.div>
    </div>
  );
}
