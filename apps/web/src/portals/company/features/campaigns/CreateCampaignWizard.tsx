import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Upload,
  Calendar,
  AlertCircle,
  Truck,
  IndianRupee,
  FileText,
  ShieldCheck,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import {
  PRINT_MATERIALS,
  CAMPAIGN_STATUS,
  VEHICLE_TYPES,
  INSTALL_APPROVERS,
  type PrintMaterial,
} from '@ap/shared-constants';
import type {
  CampaignPricePreviewDto,
  CampaignRulesDto,
  DriverAvailabilityDto,
} from '@ap/shared-types';
import { useApi } from '../../../../shared/lib/api';
import { Button } from '../../../../shared/components/Button';
import { Card } from '../../../../shared/components/Card';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { Spinner } from '../../../../shared/components/Spinner';

const STEPS = [
  { id: 1, name: 'Basics' },
  { id: 2, name: 'Targeting' },
  { id: 3, name: 'Schedule' },
  { id: 4, name: 'Pricing' },
  { id: 5, name: 'Poster & Print' },
  { id: 6, name: 'Review & Submit' },
];

export function CreateCampaignWizard() {
  const { t } = useTranslation();
  const api = useApi();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [rules, setRules] = useState<CampaignRulesDto | null>(null);
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cityId, setCityId] = useState('');
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [slots, setSlots] = useState<number>(20);
  const [rentPer30DaysPaise, setRentPer30DaysPaise] = useState<number>(100000); // ₹1,000 in paise
  const [printingAllowancePaise, setPrintingAllowancePaise] = useState<number>(15000); // ₹150 in paise
  const [printMaterial, setPrintMaterial] = useState<PrintMaterial>(PRINT_MATERIALS.VINYL_STICKER);
  const [printSize, setPrintSize] = useState('Standard Rear Panel (24x12 in)');
  const [policyAccepted, setPolicyAccepted] = useState(false);

  // Poster Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [posterFileId, setPosterFileId] = useState<string | null>(null);
  const [posterPreviewUrl, setPosterPreviewUrl] = useState<string | null>(null);
  const [isUploadingPoster, setIsUploadingPoster] = useState(false);
  const [posterUploadError, setPosterUploadError] = useState<string | null>(null);

  // Live Async Data
  const [availability, setAvailability] = useState<DriverAvailabilityDto | null>(null);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [pricePreview, setPricePreview] = useState<CampaignPricePreviewDto | null>(null);
  const [isLoadingPricing, setIsLoadingPricing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load Rules and Cities
  useEffect(() => {
    async function loadData() {
      try {
        const [rulesRes, citiesRes] = await Promise.all([
          api.getCampaignRules(),
          api.listCities(),
        ]);
        setRules(rulesRes);
        setCities(citiesRes);
        if (citiesRes.length > 0 && citiesRes[0]) {
          setCityId(citiesRes[0].id);
        }

        // Set default dates: start = today + minLeadDays, end = start + 30 days
        const start = new Date();
        start.setDate(start.getDate() + (rulesRes.minLeadDays || 3));
        const startStr = start.toISOString().split('T')[0] || '';
        const end = new Date(start);
        end.setDate(end.getDate() + 30);
        const endStr = end.toISOString().split('T')[0] || '';

        setStartDate(startStr);
        setEndDate(endStr);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Failed to load initial configuration');
      } finally {
        setIsLoadingInitial(false);
      }
    }
    loadData();
  }, [api]);

  // Load Zones when City changes
  useEffect(() => {
    if (!cityId) return;
    async function loadZones() {
      try {
        const res = await api.listZones(cityId);
        setZones(res);
        setSelectedZoneIds([]);
      } catch {
        setZones([]);
      }
    }
    loadZones();
  }, [api, cityId]);

  // Fetch driver availability
  useEffect(() => {
    if (!cityId) return;
    let isCancelled = false;
    async function fetchAvailability() {
      setIsLoadingAvailability(true);
      try {
        const res = await api.getDriverAvailability({
          cityId,
          vehicleType: 'AUTO_RICKSHAW',
          zoneIds: selectedZoneIds.length > 0 ? selectedZoneIds : undefined,
        });
        if (!isCancelled) setAvailability(res);
      } catch {
        if (!isCancelled) setAvailability(null);
      } finally {
        if (!isCancelled) setIsLoadingAvailability(false);
      }
    }
    fetchAvailability();
    return () => {
      isCancelled = true;
    };
  }, [api, cityId, selectedZoneIds]);

  // Duration in days
  const durationDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    return Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
  }, [startDate, endDate]);

  // Fetch price preview
  useEffect(() => {
    if (!startDate || !endDate || durationDays <= 0 || slots <= 0) return;
    let isCancelled = false;
    async function fetchPricing() {
      setIsLoadingPricing(true);
      try {
        const res = await api.previewCampaignPrice({
          slots,
          startDate,
          endDate,
          rentPer30DaysPaise,
          printingAllowancePaise,
        });
        if (!isCancelled) setPricePreview(res);
      } catch {
        if (!isCancelled) setPricePreview(null);
      } finally {
        if (!isCancelled) setIsLoadingPricing(false);
      }
    }
    fetchPricing();
    return () => {
      isCancelled = true;
    };
  }, [api, slots, startDate, endDate, durationDays, rentPer30DaysPaise, printingAllowancePaise]);

  // Poster File Selection Handler
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPosterUploadError(null);

    // 1. Client-side format check
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPosterUploadError('Only JPEG, PNG, or WEBP images are allowed');
      return;
    }

    // 2. Client-side size check (max 25MB)
    const maxBytes = rules?.maxPosterUploadBytes ?? 26214400;
    if (file.size > maxBytes) {
      setPosterUploadError(`File size exceeds maximum allowed (${Math.round(maxBytes / 1024 / 1024)}MB)`);
      return;
    }

    // 3. Client-side dimension check (width >= 1200px)
    const minWidth = rules?.minPosterWidthPx ?? 1200;
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      if (img.width < minWidth) {
        setPosterUploadError(`Image width must be at least ${minWidth}px (uploaded: ${img.width}px) for print quality`);
        return;
      }

      // Upload file
      setIsUploadingPoster(true);
      try {
        const uploaded = await api.uploadFile(file, {
          fileType: 'CAMPAIGN_POSTER',
          fileName: file.name,
          mimeType: file.type,
          metadata: { width: img.width, height: img.height },
        });
        setPosterFileId(uploaded.fileId);

        // Fetch display preview
        const urlRes = await api.getFileUrl(uploaded.fileId, 'preview');
        setPosterPreviewUrl(urlRes.url);
      } catch (err) {
        setPosterUploadError(err instanceof Error ? err.message : 'Poster upload failed');
      } finally {
        setIsUploadingPoster(false);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setPosterUploadError('Failed to read image file');
    };

    img.src = objectUrl;
  };

  // Submission handler
  const handleSubmit = async (submitForReview: boolean) => {
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      // 1. Create or save draft
      const draft = await api.createCampaignDraft({
        title: title.trim(),
        description: description.trim() || undefined,
        cityId,
        zoneIds: selectedZoneIds,
        targetVehicleType: VEHICLE_TYPES.AUTO_RICKSHAW,
        installApprover: INSTALL_APPROVERS.PLATFORM,
        startDate,
        endDate,
        slots,
        rentPer30DaysPaise,
        printingAllowancePaise,
        posterFileId: posterFileId ?? undefined,
        printMaterial,
        printSize,
      });

      // 2. Submit for review if requested
      if (submitForReview) {
        await api.submitCampaign(draft.id);
      }

      navigate(`/company/campaigns/${draft.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isStepValid = useMemo(() => {
    switch (currentStep) {
      case 1:
        return title.trim().length >= 3;
      case 2:
        return !!cityId;
      case 3:
        if (!startDate || !endDate) return false;
        if (!rules) return true;
        return (
          durationDays >= rules.minCampaignDays &&
          durationDays <= rules.maxCampaignDays
        );
      case 4:
        if (!rules) return true;
        return (
          slots >= rules.minSlots &&
          slots <= rules.maxSlots &&
          rentPer30DaysPaise >= rules.minRentPer30DaysPaise &&
          rentPer30DaysPaise <= rules.maxRentPer30DaysPaise
        );
      case 5:
        return !!posterFileId;
      case 6:
        return policyAccepted;
      default:
        return true;
    }
  }, [currentStep, title, cityId, startDate, endDate, durationDays, slots, rentPer30DaysPaise, posterFileId, policyAccepted, rules]);

  if (isLoadingInitial) {
    return (
      <div className="flex justify-center items-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/company/campaigns')} className="p-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <PageHeader
          title={t('campaigns.createTitle', 'Create Poster Campaign')}
          description={t('campaigns.createSubtitle', 'Configure your target area, schedule, artwork, and pricing')}
        />
      </div>

      {/* Stepper */}
      <div className="border border-border rounded-xl bg-surface p-4 shadow-sm">
        <div className="grid grid-cols-6 gap-2 text-center">
          {STEPS.map((step) => {
            const isCompleted = step.id < currentStep;
            const isCurrent = step.id === currentStep;

            return (
              <div key={step.id} className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold mb-1 transition-colors ${
                    isCompleted
                      ? 'bg-emerald-500 text-white'
                      : isCurrent
                      ? 'bg-primary text-primaryText ring-2 ring-primary/20'
                      : 'bg-surfaceAlt text-textSecondary'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : step.id}
                </div>
                <span
                  className={`text-[11px] hidden sm:block truncate ${
                    isCurrent ? 'font-semibold text-textPrimary' : 'text-textSecondary'
                  }`}
                >
                  {step.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {submitError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Step Content */}
      <Card className="p-6">
        {/* STEP 1: BASICS */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-textPrimary">1. Campaign Basics</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-textPrimary mb-1">
                  Campaign Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Diwali Mega Sale Promotion 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-textPrimary focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-textPrimary mb-1">Description (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Internal notes or goals for this advertising campaign..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-textPrimary focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: TARGETING */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-textPrimary">2. Geographic Targeting</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-textPrimary mb-1">
                  Target City <span className="text-red-500">*</span>
                </label>
                <select
                  value={cityId}
                  onChange={(e) => setCityId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-textPrimary focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </div>

              {zones.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-textPrimary mb-2">
                    Specific Zones (Optional - select none for entire city)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-3 border border-border rounded-lg bg-surfaceAlt/30">
                    {zones.map((zone) => {
                      const isChecked = selectedZoneIds.includes(zone.id);
                      return (
                        <label
                          key={zone.id}
                          className="flex items-center gap-2 text-xs text-textPrimary cursor-pointer hover:text-primary transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedZoneIds([...selectedZoneIds, zone.id]);
                              } else {
                                setSelectedZoneIds(selectedZoneIds.filter((id) => id !== zone.id));
                              }
                            }}
                            className="rounded border-border text-primary focus:ring-primary"
                          />
                          <span className="truncate">{zone.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Live Driver Availability Box */}
              <div className="p-4 rounded-xl bg-surfaceAlt border border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-textPrimary">Verified Driver Availability</h4>
                    <p className="text-xs text-textSecondary">Active approved auto-rickshaws matching your area</p>
                  </div>
                </div>

                <div className="text-right">
                  {isLoadingAvailability ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <span className="text-xl font-bold text-primary">
                      {availability?.count ?? 0} Autos
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: SCHEDULE */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-textPrimary">3. Campaign Schedule (IST)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-textPrimary mb-1">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-textPrimary focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <span className="text-[11px] text-textSecondary">
                  Requires at least {rules?.minLeadDays ?? 3} days lead time for review & printing
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-textPrimary mb-1">
                  End Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-textPrimary focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <span className="text-[11px] text-textSecondary">
                  Must be between {rules?.minCampaignDays ?? 15} and {rules?.maxCampaignDays ?? 90} days
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surfaceAlt border border-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-textPrimary">
                <Calendar className="w-4 h-4 text-primary" />
                <span>Selected Campaign Duration:</span>
              </div>
              <span className={`text-base font-bold ${durationDays < 15 || durationDays > 90 ? 'text-red-500' : 'text-textPrimary'}`}>
                {durationDays} Days
              </span>
            </div>
          </div>
        )}

        {/* STEP 4: PRICING */}
        {currentStep === 4 && (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-textPrimary">4. Slots & Budget Configuration</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-textPrimary mb-1">
                  Number of Autos (Slots) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={rules?.minSlots ?? 1}
                  max={rules?.maxSlots ?? 500}
                  value={slots}
                  onChange={(e) => setSlots(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-textPrimary focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <span className="text-[11px] text-textSecondary">Max: {rules?.maxSlots ?? 500} autos</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-textPrimary mb-1">
                  Rent per 30 Days (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={(rules?.minRentPer30DaysPaise ?? 30000) / 100}
                  max={(rules?.maxRentPer30DaysPaise ?? 500000) / 100}
                  value={rentPer30DaysPaise / 100}
                  onChange={(e) => setRentPer30DaysPaise((parseFloat(e.target.value) || 0) * 100)}
                  className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-textPrimary focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <span className="text-[11px] text-textSecondary">Min: ₹300, Max: ₹5,000</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-textPrimary mb-1">
                  Printing Allowance per Auto (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  max={(rules?.maxPrintingAllowancePaise ?? 50000) / 100}
                  value={printingAllowancePaise / 100}
                  onChange={(e) => setPrintingAllowancePaise((parseFloat(e.target.value) || 0) * 100)}
                  className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-textPrimary focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <span className="text-[11px] text-textSecondary">Paid after installation verification</span>
              </div>
            </div>

            {/* Live Pricing Breakdown Card */}
            <div className="p-5 rounded-xl bg-surfaceAlt/60 border border-border space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="text-sm font-semibold text-textPrimary">Price Preview Calculation</span>
                {isLoadingPricing && <Spinner className="h-4 w-4" />}
              </div>

              {pricePreview ? (
                <div className="space-y-2 text-xs text-textSecondary">
                  <div className="flex justify-between">
                    <span>Rent per Auto for {durationDays} Days</span>
                    <span className="text-textPrimary font-medium">₹{(pricePreview.rentForCampaignPerAutoPaise / 100).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Driver Rent Total ({slots} autos)</span>
                    <span className="text-textPrimary font-medium">₹{(Number(BigInt(pricePreview.driverRentTotalPaise)) / 100).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Driver Printing Allowance Total ({slots} autos)</span>
                    <span className="text-textPrimary font-medium">₹{(Number(BigInt(pricePreview.driverPrintingTotalPaise)) / 100).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Platform Commission ({pricePreview.commissionBps / 100}%)</span>
                    <span className="text-textPrimary font-medium">₹{(Number(BigInt(pricePreview.platformFeePaise)) / 100).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST ({pricePreview.gstBps / 100}%)</span>
                    <span className="text-textPrimary font-medium">₹{(Number(BigInt(pricePreview.gstAmountPaise)) / 100).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="pt-2 border-t border-border flex justify-between text-sm font-bold text-textPrimary">
                    <span>Total Campaign Budget (Escrow)</span>
                    <span className="text-primary text-base">₹{(Number(BigInt(pricePreview.totalChargedPaise)) / 100).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-textSecondary">Enter valid slots and schedule to view pricing preview</p>
              )}
            </div>
          </div>
        )}

        {/* STEP 5: POSTER & PRINT */}
        {currentStep === 5 && (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-textPrimary">5. Artwork & Print Specifications</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-textPrimary mb-1">Print Material</label>
                <select
                  value={printMaterial}
                  onChange={(e) => setPrintMaterial(e.target.value as PrintMaterial)}
                  className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-textPrimary focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value={PRINT_MATERIALS.VINYL_STICKER}>Vinyl Sticker (Standard High Durability)</option>
                  <option value={PRINT_MATERIALS.FLEX}>Flex Banner</option>
                  <option value={PRINT_MATERIALS.OTHER}>Other Custom Material</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-textPrimary mb-1">Print Size</label>
                <input
                  type="text"
                  value={printSize}
                  onChange={(e) => setPrintSize(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-textPrimary focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Upload Area */}
            <div>
              <label className="block text-sm font-medium text-textPrimary mb-2">
                Poster Artwork File <span className="text-red-500">*</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileSelect}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-primary rounded-xl p-8 text-center cursor-pointer bg-surfaceAlt/20 transition-colors flex flex-col items-center justify-center gap-3"
              >
                {isUploadingPoster ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-xs text-textSecondary">Uploading & optimizing poster preview...</p>
                  </div>
                ) : posterPreviewUrl ? (
                  <div className="flex flex-col items-center gap-3">
                    <img
                      src={posterPreviewUrl}
                      alt="Uploaded Poster"
                      className="max-h-48 rounded-lg shadow-sm object-contain"
                    />
                    <Button variant="outline" size="sm" type="button" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                      Change Poster
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-textPrimary">Click to upload poster artwork</p>
                      <p className="text-xs text-textSecondary mt-0.5">JPEG, PNG, or WEBP up to 25MB. Minimum width 1200px.</p>
                    </div>
                  </>
                )}
              </div>

              {posterUploadError && (
                <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {posterUploadError}
                </p>
              )}
            </div>
          </div>
        )}

        {/* STEP 6: REVIEW & SUBMIT */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-textPrimary">6. Review Campaign Details</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-surfaceAlt border border-border space-y-2">
                <span className="font-semibold text-textPrimary text-sm block">Campaign & Targeting</span>
                <p><span className="text-textSecondary">Title:</span> {title}</p>
                <p><span className="text-textSecondary">City:</span> {cities.find((c) => c.id === cityId)?.name}</p>
                <p><span className="text-textSecondary">Zones:</span> {selectedZoneIds.length > 0 ? `${selectedZoneIds.length} zones selected` : 'All City Zones'}</p>
                <p><span className="text-textSecondary">Dates:</span> {startDate} to {endDate} ({durationDays} days)</p>
                <p><span className="text-textSecondary">Target Slots:</span> {slots} Auto-rickshaws</p>
              </div>

              <div className="p-4 rounded-xl bg-surfaceAlt border border-border space-y-2">
                <span className="font-semibold text-textPrimary text-sm block">Pricing & Budget</span>
                <p><span className="text-textSecondary">Rent Rate:</span> ₹{(rentPer30DaysPaise / 100).toLocaleString('en-IN')} / 30d per auto</p>
                <p><span className="text-textSecondary">Printing Allowance:</span> ₹{(printingAllowancePaise / 100).toLocaleString('en-IN')} / auto</p>
                {pricePreview && (
                  <>
                    <p><span className="text-textSecondary">Platform Fee:</span> ₹{(Number(BigInt(pricePreview.platformFeePaise)) / 100).toLocaleString('en-IN')}</p>
                    <p><span className="text-textSecondary">GST (18%):</span> ₹{(Number(BigInt(pricePreview.gstAmountPaise)) / 100).toLocaleString('en-IN')}</p>
                    <p className="font-bold text-primary text-sm pt-1 border-t border-border">
                      Total Payable: ₹{(Number(BigInt(pricePreview.totalChargedPaise)) / 100).toLocaleString('en-IN')}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Poster Preview */}
            {posterPreviewUrl && (
              <div className="p-4 rounded-xl bg-surfaceAlt border border-border flex items-center gap-4">
                <img src={posterPreviewUrl} alt="Poster" className="w-20 h-20 rounded-lg object-cover" />
                <div className="text-xs space-y-1">
                  <span className="font-semibold text-textPrimary text-sm block">Poster Artwork Attached</span>
                  <p className="text-textSecondary">Material: {printMaterial} &bull; Size: {printSize}</p>
                  <p className="text-emerald-600 dark:text-emerald-400 font-medium">Resolution check passed (&gt;= 1200px)</p>
                </div>
              </div>
            )}

            {/* Policy Checkbox */}
            <div className="p-4 rounded-xl border border-border bg-surface flex items-start gap-3">
              <input
                type="checkbox"
                id="policy"
                checked={policyAccepted}
                onChange={(e) => setPolicyAccepted(e.target.checked)}
                className="mt-0.5 rounded border-border text-primary focus:ring-primary"
              />
              <label htmlFor="policy" className="text-xs text-textSecondary cursor-pointer leading-relaxed">
                I confirm that this poster artwork complies with the <strong className="text-textPrimary">Auto Poster Advertising Policy</strong>: it contains no illegal substances, tobacco, alcohol, adult content, hate speech, misleading claims, or intellectual property violations, and does not obstruct the vehicle registration number.
              </label>
            </div>
          </div>
        )}

        {/* Wizard Controls */}
        <div className="flex items-center justify-between pt-6 border-t border-border mt-8">
          {currentStep > 1 ? (
            <Button
              variant="outline"
              type="button"
              onClick={() => setCurrentStep((s) => s - 1)}
              disabled={isSubmitting}
            >
              Previous
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            {currentStep === 6 ? (
              <>
                <Button
                  variant="outline"
                  type="button"
                  isLoading={isSubmitting}
                  onClick={() => handleSubmit(false)}
                >
                  Save as Draft
                </Button>
                <Button
                  variant="primary"
                  type="button"
                  disabled={!isStepValid || isSubmitting}
                  isLoading={isSubmitting}
                  onClick={() => handleSubmit(true)}
                >
                  Submit for Admin Review
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                type="button"
                disabled={!isStepValid}
                onClick={() => setCurrentStep((s) => s + 1)}
                className="inline-flex items-center gap-1.5"
              >
                <span>Next</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
