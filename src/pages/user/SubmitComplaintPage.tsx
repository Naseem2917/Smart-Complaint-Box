import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Loader2, Eye, EyeOff, Sparkles, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { createComplaintManual } from '../../services/complaints';
import { compressImage } from '../../utils/imageCompressor';
import { getCategories, removeDuplicateCategories, type Category } from '../../services/categories';
import { liveAnalyze } from '../../services/ai';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Textarea from '../../components/common/Textarea';
import type { UrgencyLevel } from '../../types';

const SubmitComplaintPage: React.FC = () => {
    // Wizard step: 1 = Describe Issue, 2 = Category, Priority & Photo
    const [step, setStep] = useState<1 | 2>(1);

    const [description, setDescription] = useState('');
    const [image, setImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedPriority, setSelectedPriority] = useState<UrgencyLevel>('Medium');
    const [categories, setCategories] = useState<Category[]>([]);
    const [loadingCategories, setLoadingCategories] = useState(true);

    // AI suggestion state
    const [aiSuggestedCategory, setAiSuggestedCategory] = useState('');
    const [aiSuggestedPriority, setAiSuggestedPriority] = useState<UrgencyLevel | ''>('');
    const [aiSuggestedImage, setAiSuggestedImage] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [userOverrodeCategory, setUserOverrodeCategory] = useState(false);
    const [userOverrodePriority, setUserOverrodePriority] = useState(false);
    const [isTextValid, setIsTextValid] = useState<boolean | null>(null);
    const [showInvalidWarning, setShowInvalidWarning] = useState(false);

    const { firebaseUser, userData } = useAuth();
    const { showSuccess, showError } = useNotification();
    const navigate = useNavigate();

    // Load categories from Firestore
    useEffect(() => {
        const loadCategories = async () => {
            try {
                await removeDuplicateCategories();
                const cats = await getCategories();
                const seen = new Set<string>();
                const uniqueCats = cats.filter(c => {
                    if (c.enabled && !seen.has(c.name)) {
                        seen.add(c.name);
                        return true;
                    }
                    return false;
                });
                setCategories(uniqueCats);
            } catch (error) {
                console.error('Failed to load categories:', error);
            }
            setLoadingCategories(false);
        };
        loadCategories();
    }, []);

    // Step 1 -> Step 2: Trigger AI Analysis exactly ONCE
    const handleContinueToStep2 = async () => {
        if (!description.trim() || description.trim().length < 10) {
            showError('Description too short', 'Please provide at least 10 characters describing your issue.');
            return;
        }

        setIsAnalyzing(true);
        try {
            const result = await liveAnalyze(description);
            console.log('[AI Step 1 Analysis Result]', result);

            setIsTextValid(result.isValid);

            // Handle Gibberish / Invalid Issue Warning
            if (result.isValid === false) {
                setShowInvalidWarning(true);
                setIsAnalyzing(false);
                return;
            }

            // Apply AI suggestions if user hasn't overridden
            if (result.category) {
                setAiSuggestedCategory(result.category);
                if (!userOverrodeCategory) {
                    setSelectedCategory(result.category);
                }
            }
            if (result.priority) {
                const priority = result.priority as UrgencyLevel;
                setAiSuggestedPriority(priority);
                if (!userOverrodePriority) {
                    setSelectedPriority(priority);
                }
            }
            if (result.suggestedImage) {
                setAiSuggestedImage(result.suggestedImage);
            }

            // Move to Step 2
            setStep(2);
        } catch (error) {
            console.error('AI analysis error on next step:', error);
            // Even if AI fails, allow user to proceed to Step 2 and pick manually
            setStep(2);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // User forces proceeding despite invalid warning
    const handleProceedAnyway = () => {
        setShowInvalidWarning(false);
        setStep(2);
    };

    // Handle manual category selection (user override)
    const handleCategorySelect = (categoryName: string) => {
        setSelectedCategory(categoryName);
        if (aiSuggestedCategory && categoryName !== aiSuggestedCategory) {
            setUserOverrodeCategory(true);
        }
    };

    // Handle manual priority selection (user override)
    const handlePrioritySelect = (priority: UrgencyLevel) => {
        setSelectedPriority(priority);
        if (aiSuggestedPriority && priority !== aiSuggestedPriority) {
            setUserOverrodePriority(true);
        }
    };

    const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                showError('Image too large', 'Please select an image under 5MB.');
                return;
            }
            setImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    }, [showError]);

    const removeImage = () => {
        setImage(null);
        setImagePreview(null);
    };

    // Final Submit Handler on Step 2
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!firebaseUser || !userData) {
            showError('Not logged in', 'Please log in to submit a complaint.');
            return;
        }

        if (description.trim().length < 10) {
            showError('Description too short', 'Please provide more details about your issue.');
            setStep(1);
            return;
        }

        if (!selectedCategory) {
            showError('Category required', 'Please select a category for your complaint.');
            return;
        }

        setLoading(true);

        try {
            // Compress image if provided
            let imageBase64: string = '';

            if (image) {
                try {
                    imageBase64 = await compressImage(image);
                } catch (compressionError) {
                    console.error('Image compression failed:', compressionError);
                    showError('Image Error', 'Failed to process image. Please try a different one.');
                    setLoading(false);
                    return;
                }
            }

            await createComplaintManual(
                firebaseUser.uid,
                userData.displayName || 'User',
                userData.email || '',
                description,
                selectedCategory,
                selectedPriority,
                imageBase64 || undefined,
                isAnonymous
            );

            showSuccess('Complaint submitted!', 'Your complaint has been registered successfully.');
            navigate('/history');
        } catch (error: any) {
            showError('Submission failed', error.message || 'Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            {/* Header with Step indicator */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Raise a Complaint
                    </h1>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                        Step {step} of 2
                    </span>
                </div>

                {/* Stepper Progress Bar */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className={`h-1.5 rounded-full transition-all ${step >= 1 ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                    <div className={`h-1.5 rounded-full transition-all ${step >= 2 ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                </div>
            </div>

            <AnimatePresence mode="wait">
                {/* ── STEP 1: Describe Your Issue ────────────────────────────── */}
                {step === 1 && (
                    <motion.div
                        key="step-1"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                        <Card className="mb-6">
                            <label className="block text-base font-semibold text-gray-800 dark:text-gray-200 mb-2">
                                📝 Describe Your Issue <span className="text-red-500">*</span>
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                Explain the problem clearly (e.g., location, room number, what broke). AI will automatically detect the category, priority, and suggest photo requirements.
                            </p>

                            <Textarea
                                placeholder="e.g. Water is leaking continuously from the washroom tap in 3rd floor hostel C wing. The floor is getting flooded..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={6}
                                className="text-base"
                                required
                            />

                            <div className="flex items-center justify-between mt-3 text-xs text-gray-500 dark:text-gray-400">
                                <span>Minimum 10 characters</span>
                                <span className={description.trim().length >= 10 ? 'text-emerald-600 font-medium' : ''}>
                                    {description.trim().length} characters
                                </span>
                            </div>
                        </Card>

                        {/* Continue Button */}
                        <Button
                            type="button"
                            fullWidth
                            loading={isAnalyzing}
                            disabled={isAnalyzing || description.trim().length < 10}
                            onClick={handleContinueToStep2}
                            className="flex items-center justify-center gap-2 py-3 text-base shadow-lg shadow-primary-500/20"
                        >
                            {isAnalyzing ? (
                                <>
                                    <Sparkles className="w-5 h-5 animate-spin text-amber-300" />
                                    <span>AI Analyzing Issue...</span>
                                </>
                            ) : (
                                <>
                                    <span>Next: Review & Finalize</span>
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </Button>
                    </motion.div>
                )}

                {/* ── STEP 2: Category, Priority, Photo & Submit ────────────── */}
                {step === 2 && (
                    <motion.div
                        key="step-2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2 }}
                    >
                        {/* Issue preview with edit button */}
                        <Card className="mb-4 bg-primary-50/50 dark:bg-primary-950/20 border border-primary-200/50 dark:border-primary-800/30">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <span className="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider">
                                        Your Issue Description
                                    </span>
                                    <p className="text-sm text-gray-800 dark:text-gray-200 mt-1 line-clamp-2">
                                        "{description}"
                                    </p>
                                    {isTextValid === false && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1">
                                            ⚠️ Notice: This issue was flagged as unclear. Please make sure the category and priority below are correct.
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="text-xs text-primary-600 dark:text-primary-400 font-semibold hover:underline flex items-center gap-1 shrink-0 pt-1"
                                >
                                    <ArrowLeft className="w-3.5 h-3.5" /> Edit
                                </button>
                            </div>
                        </Card>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Category Section */}
                            <Card padding="md">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                        📁 Category <span className="text-red-500">*</span>
                                    </label>
                                    {aiSuggestedCategory && (
                                        <span className="text-xs font-medium text-primary-600 dark:text-primary-400 flex items-center gap-1">
                                            <Sparkles className="w-3 h-3 text-amber-500" /> AI Suggested
                                        </span>
                                    )}
                                </div>

                                {loadingCategories ? (
                                    <div className="flex items-center justify-center gap-2 text-gray-500 py-4">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Loading categories...</span>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {categories.map((cat) => (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => handleCategorySelect(cat.name)}
                                                className={`p-3 rounded-xl border-2 transition-all text-left relative ${selectedCategory === cat.name
                                                    ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 ring-2 ring-primary-500'
                                                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-primary-300'
                                                    }`}
                                            >
                                                {aiSuggestedCategory === cat.name && !userOverrodeCategory && (
                                                    <span className="absolute -top-1.5 -right-1.5 bg-primary-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                                                        <Sparkles className="w-2.5 h-2.5 text-amber-300" /> AI
                                                    </span>
                                                )}
                                                <span className="text-xl">{cat.icon || '📋'}</span>
                                                <p className={`text-sm font-medium mt-1 ${selectedCategory === cat.name
                                                    ? 'text-primary-700 dark:text-primary-300 font-semibold'
                                                    : 'text-gray-700 dark:text-gray-300'
                                                    }`}>
                                                    {cat.name}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </Card>

                            {/* Priority Section */}
                            <Card padding="md">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                        🎯 Priority / Urgency <span className="text-red-500">*</span>
                                    </label>
                                    {aiSuggestedPriority && (
                                        <span className="text-xs font-medium text-primary-600 dark:text-primary-400 flex items-center gap-1">
                                            <Sparkles className="w-3 h-3 text-amber-500" /> AI Assessed
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {[
                                        { value: 'Low', label: '🟢 Low', color: 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-400 dark:border-emerald-600' },
                                        { value: 'Medium', label: '🟡 Medium', color: 'bg-amber-100 dark:bg-amber-900/30 border-amber-400 dark:border-amber-600' },
                                        { value: 'High', label: '🟠 High', color: 'bg-orange-100 dark:bg-orange-900/30 border-orange-400 dark:border-orange-600' },
                                        { value: 'Critical', label: '🔴 Critical', color: 'bg-red-100 dark:bg-red-900/30 border-red-400 dark:border-red-600' }
                                    ].map((priority) => (
                                        <button
                                            key={priority.value}
                                            type="button"
                                            onClick={() => handlePrioritySelect(priority.value as UrgencyLevel)}
                                            className={`p-3 rounded-xl border-2 transition-all font-medium text-sm relative ${selectedPriority === priority.value
                                                ? `${priority.color} ring-2 ring-primary-500 font-bold`
                                                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-primary-300'
                                                }`}
                                        >
                                            {priority.label}
                                            {aiSuggestedPriority === priority.value && !userOverrodePriority && (
                                                <span className="absolute -top-1.5 -right-1.5 bg-primary-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                                                    <Sparkles className="w-2.5 h-2.5 text-amber-300" /> AI
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </Card>

                            {/* Photo Upload with AI Suggestion */}
                            <Card padding="md">
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                        📸 Upload Photo (Optional)
                                    </label>
                                    <span className="text-xs text-gray-500">Max 5MB</span>
                                </div>

                                {aiSuggestedImage && (
                                    <div className="mb-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                                        <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                        <span>
                                            <strong>AI Photo Tip:</strong> {aiSuggestedImage}
                                        </span>
                                    </div>
                                )}

                                {!imagePreview ? (
                                    <label className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-primary-500 transition-colors">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="p-3 rounded-full bg-primary-50 dark:bg-primary-900/20">
                                                <Upload className="w-5 h-5 text-primary-500" />
                                            </div>
                                            <span className="text-xs text-gray-500">Click to upload or drag image</span>
                                            <span className="text-[11px] text-gray-400">PNG, JPG up to 5MB (compressed automatically)</span>
                                        </div>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageChange}
                                            className="hidden"
                                        />
                                    </label>
                                ) : (
                                    <div className="relative">
                                        <img
                                            src={imagePreview}
                                            alt="Preview"
                                            className="w-full h-44 object-cover rounded-xl"
                                        />
                                        <button
                                            type="button"
                                            onClick={removeImage}
                                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </Card>

                            {/* Anonymous Toggle */}
                            <Card padding="md">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {isAnonymous ? (
                                            <EyeOff className="w-5 h-5 text-primary-500" />
                                        ) : (
                                            <Eye className="w-5 h-5 text-gray-400" />
                                        )}
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                                Submit Anonymously
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                Your identity will be hidden from staff and admins
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsAnonymous(!isAnonymous)}
                                        className={`relative w-12 h-6 rounded-full transition-colors ${isAnonymous ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                    >
                                        <span
                                            className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${isAnonymous ? 'translate-x-6' : ''}`}
                                        />
                                    </button>
                                </div>
                            </Card>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setStep(1)}
                                    disabled={loading}
                                    className="flex items-center justify-center gap-1.5 px-5"
                                >
                                    <ArrowLeft className="w-4 h-4" /> Back
                                </Button>
                                <Button
                                    type="submit"
                                    fullWidth
                                    loading={loading}
                                    disabled={loading || !selectedCategory}
                                    className="flex-1 py-3 text-base font-semibold shadow-lg shadow-primary-500/20"
                                >
                                    {loading ? 'Submitting Complaint...' : 'Submit Complaint 🚀'}
                                </Button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Invalid Text / Gibberish Warning Modal (Preserved as requested) */}
            <AnimatePresence>
                {showInvalidWarning && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-xl"
                        >
                            <div className="text-center mb-4">
                                <span className="text-4xl">⚠️</span>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-2">
                                    Invalid Issue Detected
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
                                    Your issue description appears to be unclear, incomplete, or random test text. Are you sure you want to proceed?
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowInvalidWarning(false)}
                                    className="flex-1 py-2.5 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
                                >
                                    Edit Description
                                </button>
                                <button
                                    type="button"
                                    onClick={handleProceedAnyway}
                                    className="flex-1 py-2.5 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors text-sm"
                                >
                                    Proceed Anyway
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SubmitComplaintPage;
