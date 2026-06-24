import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap, CheckCircle2, UserPlus, RefreshCw, Search } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Reveal } from "@/components/site/Reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  lookupStudentByIdentifier,
  submitOnlineEnrollment,
  getMissingFields,
} from "@/lib/online-enrollment";
import type { OnlineEnrollmentPayload, WebsiteEnrollmentType } from "@/lib/online-enrollment";

export const Route = createFileRoute("/enroll")({
  head: () => ({
    meta: [
      { title: "Online Enrollment | St. Theresa's School of Novaliches" },
      {
        name: "description",
        content:
          "Enroll online at St. Theresa's School of Novaliches for SY 2026–2027. Open for New Students, Continuing Students, Returnees, and Transferees.",
      },
      { property: "og:title", content: "Online Enrollment — St. Theresa's School of Novaliches" },
      { property: "og:description", content: "Secure your slot for School Year 2026–2027." },
    ],
  }),
  component: Enroll,
});

const STATUSES = [
  { id: "Continuing Student", icon: RefreshCw },
  { id: "New Student", icon: UserPlus },
];

const LEVELS = [
  "Nursery",
  "Kinder I",
  "Kinder II",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
];

const SHS_STRANDS = [
  "STEM",
  "ABM",
  "HUMSS",
  "GAS",
  "TVL",
  "Sports Track",
  "Arts and Design Track",
];

const GENDERS = ["Male", "Female"];

const RELATIONSHIPS = ["Father", "Mother", "Guardian", "Sibling", "Other"];

function Field({
  id,
  label,
  children,
  required,
}: {
  id: string;
  label: string;
  children?: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function Enroll() {
  const [status, setStatus] = useState<WebsiteEnrollmentType>("New Student");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lrnBusy, setLrnBusy] = useState(false);
  const [lrnFound, setLrnFound] = useState(false);
  const [referenceNo, setReferenceNo] = useState("");

  // Student identity
  const [lrn, setLrn] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");

  // Contact
  const [email, setEmail] = useState("");
  const [contactNo, setContactNo] = useState("");

  // Address
  const [completeAddress, setCompleteAddress] = useState("");
  const [barangay, setBarangay] = useState("");
  const [cityMunicipality, setCityMunicipality] = useState("");
  const [province, setProvince] = useState("");
  const [zipCode, setZipCode] = useState("");

  // Academic
  const [gradeLevelApplyingFor, setGradeLevelApplyingFor] = useState("");
  const [schoolYear, setSchoolYear] = useState("2026–2027");
  const [strandOrTrack, setStrandOrTrack] = useState("");
  const [previousSchool, setPreviousSchool] = useState("");
  const [previousSchoolAddress, setPreviousSchoolAddress] = useState("");

  // Guardian
  const [guardianName, setGuardianName] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");
  const [guardianContactNo, setGuardianContactNo] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianAddress, setGuardianAddress] = useState("");

  const isSHS = ["Grade 11", "Grade 12"].includes(gradeLevelApplyingFor);

  const handleStatusChange = (newStatus: WebsiteEnrollmentType) => {
    setStatus(newStatus);
    setLrn("");
    setLrnFound(false);
  };

  const handleLrnLookup = async () => {
    if (!lrn.trim()) {
      toast.error("Please enter your LRN or Student Number.");
      return;
    }
    setLrnBusy(true);
    setLrnFound(false);
    try {
      const result = await lookupStudentByIdentifier(lrn);
      if (!result) {
        toast.error("No student record found for the provided LRN or Student Number.");
        return;
      }
      setFirstName(result.firstName);
      setLastName(result.lastName);
      setMiddleName(result.middleName ?? "");
      if (result.yearLevel) setGradeLevelApplyingFor(result.yearLevel);
      if (result.trackOrCourse) setStrandOrTrack(result.trackOrCourse);
      setLrnFound(true);
      toast.success("Student record found. Please review and complete the remaining enrollment details.");
    } catch {
      toast.error("Student lookup failed. Please try again.");
    } finally {
      setLrnBusy(false);
    }
  };

  const resetForm = () => {
    setStatus("New Student");
    setLrn("");
    setFirstName("");
    setLastName("");
    setMiddleName("");
    setBirthDate("");
    setGender("");
    setEmail("");
    setContactNo("");
    setCompleteAddress("");
    setBarangay("");
    setCityMunicipality("");
    setProvince("");
    setZipCode("");
    setGradeLevelApplyingFor("");
    setSchoolYear("2026–2027");
    setStrandOrTrack("");
    setPreviousSchool("");
    setPreviousSchoolAddress("");
    setGuardianName("");
    setGuardianRelationship("");
    setGuardianContactNo("");
    setGuardianEmail("");
    setGuardianAddress("");
    setLrnFound(false);
    setReferenceNo("");
    setSubmitted(false);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (status === "Continuing Student" && !lrnFound) {
      toast.error("Please look up and verify the student before submitting.");
      return;
    }

    const payload: OnlineEnrollmentPayload = {
      enrollmentType: status,
      lrn: lrn.trim() || undefined,
      firstName,
      lastName,
      middleName: middleName || undefined,
      birthDate: birthDate || undefined,
      gender: gender || undefined,
      email: email || undefined,
      contactNo: contactNo || undefined,
      completeAddress: completeAddress || undefined,
      barangay: barangay || undefined,
      cityMunicipality: cityMunicipality || undefined,
      province: province || undefined,
      zipCode: zipCode || undefined,
      gradeLevelApplyingFor,
      schoolYear,
      strandOrTrack: strandOrTrack || undefined,
      previousSchool: previousSchool || undefined,
      previousSchoolAddress: previousSchoolAddress || undefined,
      guardianName: guardianName || undefined,
      guardianRelationship: guardianRelationship || undefined,
      guardianContactNo: guardianContactNo || undefined,
      guardianEmail: guardianEmail || undefined,
      guardianAddress: guardianAddress || undefined,
      submittedFrom: "stsn-website",
    };

    const missingFields = getMissingFields(payload);
    if (missingFields.length > 0) {
      toast.error(`Please complete the required fields: ${missingFields.join(", ")}`);
      return;
    }

    setBusy(true);
    try {
      const result = await submitOnlineEnrollment(payload);
      const ref = result?.referenceNumber ?? result?.reference_number ?? "";
      setReferenceNo(ref);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast.success("Enrollment form submitted successfully!");
    } catch {
      toast.error("Submission failed. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <>
        <PageHero eyebrow="Thank you!" title="Application Received" />
        <section className="py-24">
          <div className="mx-auto max-w-xl px-4 text-center">
            <CheckCircle2 className="mx-auto size-16 text-gold" />
            <h2 className="mt-6 font-display text-2xl font-semibold">
              We've received your enrollment
            </h2>
            {referenceNo && (
              <p className="mt-4 rounded-xl border bg-card px-6 py-3 text-sm">
                Reference Number:{" "}
                <span className="font-bold text-gold">{referenceNo}</span>
              </p>
            )}
            <p className="mt-3 text-muted-foreground">
              Our admissions office will contact you within 3–5 working days regarding the next
              steps, assessment schedule, and requirements.
            </p>
            <Button variant="brown" size="lg" className="mt-8" onClick={resetForm}>
              Submit Another Form
            </Button>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHero
        eyebrow="Admissions Open · SY 2026–2027"
        title="Online Enrollment"
        subtitle="Complete the form below to begin your Theresian journey."
      />

      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <form onSubmit={onSubmit} className="space-y-8">
            {/* Student status */}
            <Reveal>
              <fieldset className="rounded-2xl border bg-card p-7 shadow-soft">
                <legend className="flex items-center gap-2 px-2 font-display text-lg font-semibold">
                  <GraduationCap className="size-5 text-gold" /> Student Status
                </legend>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {STATUSES.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => handleStatusChange(s.id as WebsiteEnrollmentType)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-xl border p-4 text-center text-sm font-medium transition-all",
                        status === s.id
                          ? "border-transparent bg-gradient-brown text-primary-foreground shadow-soft"
                          : "bg-card hover:border-gold/60",
                      )}
                    >
                      <s.icon className="size-5" />
                      {s.id}
                    </button>
                  ))}
                </div>
              </fieldset>
            </Reveal>

            {/* Student info */}
            <Reveal delay={80}>
              <fieldset className="rounded-2xl border bg-card p-7 shadow-soft">
                <legend className="px-2 font-display text-lg font-semibold">
                  Student Information
                </legend>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {/* LRN or Student Number with optional Check Student button */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="lrn">
                      LRN or Student Number
                      {status === "Continuing Student" && (
                        <span className="text-destructive"> *</span>
                      )}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="lrn"
                        value={lrn}
                        onChange={(e) => {
                          setLrn(e.target.value);
                          setLrnFound(false);
                        }}
                        maxLength={20}
                        placeholder={status === "Continuing Student" ? "Enter LRN or Student Number" : "Optional"}
                        className="flex-1"
                      />
                      {status === "Continuing Student" && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleLrnLookup}
                          disabled={lrnBusy || !lrn.trim()}
                        >
                          <Search className="mr-1 size-4" />
                          {lrnBusy ? "Checking..." : "Check Student"}
                        </Button>
                      )}
                    </div>
                    {lrnFound && (
                      <p className="text-xs text-green-600">
                        ✓ Student record found. Review the auto-filled fields below.
                      </p>
                    )}
                  </div>

                  <Field id="lname" label="Last Name" required>
                    <Input
                      id="lname"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      maxLength={60}
                    />
                  </Field>
                  <Field id="fname" label="First Name" required>
                    <Input
                      id="fname"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      maxLength={60}
                    />
                  </Field>
                  <Field id="mname" label="Middle Name">
                    <Input
                      id="mname"
                      value={middleName}
                      onChange={(e) => setMiddleName(e.target.value)}
                      maxLength={60}
                    />
                  </Field>
                  <Field id="birthdate" label="Birthdate" required>
                    <Input
                      id="birthdate"
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      required
                    />
                  </Field>
                  <Field id="gender" label="Gender" required>
                    <Select value={gender} onValueChange={setGender} required>
                      <SelectTrigger id="gender">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDERS.map((g) => (
                          <SelectItem key={g} value={g}>
                            {g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </fieldset>
            </Reveal>

            {/* Contact info */}
            <Reveal delay={100}>
              <fieldset className="rounded-2xl border bg-card p-7 shadow-soft">
                <legend className="px-2 font-display text-lg font-semibold">
                  Contact Information
                </legend>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field id="contactno" label="Contact Number" required>
                    <Input
                      id="contactno"
                      value={contactNo}
                      onChange={(e) => setContactNo(e.target.value)}
                      inputMode="tel"
                      maxLength={20}
                      required
                    />
                  </Field>
                  <Field id="email" label="Email Address">
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      maxLength={100}
                    />
                  </Field>
                </div>
              </fieldset>
            </Reveal>

            {/* Address info */}
            <Reveal delay={120}>
              <fieldset className="rounded-2xl border bg-card p-7 shadow-soft">
                <legend className="px-2 font-display text-lg font-semibold">
                  Address Information
                </legend>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="address">
                      Complete Address <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="address"
                      value={completeAddress}
                      onChange={(e) => setCompleteAddress(e.target.value)}
                      placeholder="House no., street, subdivision"
                      maxLength={200}
                      required
                    />
                  </div>
                  <Field id="barangay" label="Barangay" required>
                    <Input
                      id="barangay"
                      value={barangay}
                      onChange={(e) => setBarangay(e.target.value)}
                      maxLength={100}
                      required
                    />
                  </Field>
                  <Field id="city" label="City / Municipality" required>
                    <Input
                      id="city"
                      value={cityMunicipality}
                      onChange={(e) => setCityMunicipality(e.target.value)}
                      maxLength={100}
                      required
                    />
                  </Field>
                  <Field id="province" label="Province" required>
                    <Input
                      id="province"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      maxLength={100}
                      required
                    />
                  </Field>
                  <Field id="zip" label="ZIP Code">
                    <Input
                      id="zip"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      inputMode="numeric"
                      maxLength={10}
                    />
                  </Field>
                </div>
              </fieldset>
            </Reveal>

            {/* Academic */}
            <Reveal delay={140}>
              <fieldset className="rounded-2xl border bg-card p-7 shadow-soft">
                <legend className="px-2 font-display text-lg font-semibold">
                  Academic Details
                </legend>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field id="sy" label="School Year" required>
                    <Input
                      id="sy"
                      value={schoolYear}
                      onChange={(e) => setSchoolYear(e.target.value)}
                      maxLength={20}
                      required
                    />
                  </Field>
                  <Field id="level" label="Grade / Level Applying For" required>
                    <Select
                      value={gradeLevelApplyingFor}
                      onValueChange={(val) => {
                        setGradeLevelApplyingFor(val);
                        setStrandOrTrack("");
                      }}
                      required
                    >
                      <SelectTrigger id="level">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        {LEVELS.map((l) => (
                          <SelectItem key={l} value={l}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  {isSHS && (
                    <Field id="strand" label="Strand / Track" required>
                      <Select value={strandOrTrack} onValueChange={setStrandOrTrack} required>
                        <SelectTrigger id="strand">
                          <SelectValue placeholder="Select strand / track" />
                        </SelectTrigger>
                        <SelectContent>
                          {SHS_STRANDS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                  {status === "New Student" && (
                    <>
                      <Field id="prevschool" label="Previous School">
                        <Input
                          id="prevschool"
                          value={previousSchool}
                          onChange={(e) => setPreviousSchool(e.target.value)}
                          maxLength={150}
                        />
                      </Field>
                      <Field id="prevschooladdr" label="Previous School Address">
                        <Input
                          id="prevschooladdr"
                          value={previousSchoolAddress}
                          onChange={(e) => setPreviousSchoolAddress(e.target.value)}
                          maxLength={150}
                        />
                      </Field>
                    </>
                  )}
                </div>
              </fieldset>
            </Reveal>

            {/* Guardian info */}
            <Reveal delay={160}>
              <fieldset className="rounded-2xl border bg-card p-7 shadow-soft">
                <legend className="px-2 font-display text-lg font-semibold">
                  Parent / Guardian Information
                </legend>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field id="guardianname" label="Guardian Name" required>
                    <Input
                      id="guardianname"
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      maxLength={120}
                      required
                    />
                  </Field>
                  <Field id="guardianrel" label="Relationship" required>
                    <Select
                      value={guardianRelationship}
                      onValueChange={setGuardianRelationship}
                      required
                    >
                      <SelectTrigger id="guardianrel">
                        <SelectValue placeholder="Select relationship" />
                      </SelectTrigger>
                      <SelectContent>
                        {RELATIONSHIPS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field id="guardiancontact" label="Guardian Contact Number" required>
                    <Input
                      id="guardiancontact"
                      value={guardianContactNo}
                      onChange={(e) => setGuardianContactNo(e.target.value)}
                      inputMode="tel"
                      maxLength={20}
                      required
                    />
                  </Field>
                  <Field id="guardianemail" label="Guardian Email">
                    <Input
                      id="guardianemail"
                      type="email"
                      value={guardianEmail}
                      onChange={(e) => setGuardianEmail(e.target.value)}
                      maxLength={100}
                    />
                  </Field>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="guardianaddr">
                      Guardian Address (if different from student)
                    </Label>
                    <Input
                      id="guardianaddr"
                      value={guardianAddress}
                      onChange={(e) => setGuardianAddress(e.target.value)}
                      maxLength={200}
                    />
                  </div>
                </div>
              </fieldset>
            </Reveal>

            <Reveal delay={200}>
              <div className="flex flex-col items-center gap-3 text-center">
                <Button
                  type="submit"
                  variant="hero"
                  size="xl"
                  disabled={busy}
                  className="w-full sm:w-auto"
                >
                  {busy ? "Submitting..." : "Submit Enrollment"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  By submitting, you agree to be contacted by the STSN Admissions Office regarding
                  your application.
                </p>
              </div>
            </Reveal>
          </form>
        </div>
      </section>
    </>
  );
}
