import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useLockBodyScroll } from '../utils/useLockBodyScroll';
import { CategoryDropdown } from './CategoryDropdown';
import { StateDropdown } from './StateDropdown';
import { CityDropdown } from './CityDropdown';
import { CustomDatePicker } from './CustomDatePicker';
import { CustomTimePicker } from './CustomTimePicker';
import { getCitiesForState, parseLocationStateAndCity, formatLocationString } from '../utils/constants';

const compressImageFile = (file, maxWidth = 1920, maxHeight = 1920, quality = 0.88) => {
  return new Promise((resolve, reject) => {
    if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = () => resolve({
        dataUrl: reader.result,
        contentType: file.type,
      });
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ dataUrl: e.target.result, contentType: file.type || 'image/jpeg' });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(outputType, quality);
        resolve({ dataUrl, contentType: outputType });
      };
      img.onerror = () => {
        resolve({ dataUrl: e.target.result, contentType: file.type || 'image/jpeg' });
      };
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
};

export const AddEvents = ({
  isOpen = false,
  onClose,
  editingEvent = null,
  initialData = null,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const fileInputRef = useRef(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);

  useLockBodyScroll(isOpen);

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    type: 'Live music',
    category: 'music',
    venue: '',
    state: 'Maharashtra',
    city: 'Pune',
    location: 'Pune, Maharashtra',
    date: new Date().toISOString().split('T')[0],
    clock: '20:00',
    price: 499,
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
    description: '',
  });

  // Synchronize state when modal opens or editingEvent / initialData changes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData(initialData);
      } else if (editingEvent) {
        const locParsed = parseLocationStateAndCity(editingEvent.location || 'Pune, Maharashtra');
        setFormData({
          title: editingEvent.title || '',
          slug: editingEvent.slug || '',
          type: editingEvent.type || editingEvent.event_type || 'Live music',
          category: editingEvent.category || 'music',
          venue: editingEvent.venue || '',
          state: editingEvent.state || locParsed.state || 'Maharashtra',
          city: editingEvent.city || locParsed.city || 'Pune',
          location: editingEvent.location || formatLocationString(editingEvent.city || locParsed.city, editingEvent.state || locParsed.state),
          date: editingEvent.date || (editingEvent.time?.split(' ')[0] || new Date().toISOString().split('T')[0]),
          clock: editingEvent.clock || (editingEvent.time?.split(' ')[1] || '20:00'),
          price: editingEvent.price !== undefined ? editingEvent.price : 499,
          image: editingEvent.image || '',
          description: editingEvent.description || '',
        });
      } else {
        setFormData({
          title: '',
          slug: '',
          type: 'Live music',
          category: 'music',
          venue: '',
          state: 'Maharashtra',
          city: 'Pune',
          location: 'Pune, Maharashtra',
          date: new Date().toISOString().split('T')[0],
          clock: '20:00',
          price: 499,
          image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
          description: '',
        });
      }
    }
  }, [isOpen, editingEvent, initialData]);

  // Handle Image Upload with Canvas Optimization
  const handleImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|avif|heic|bmp)$/i.test(file.name);
    if (!isImage) {
      showToast('Please select a valid image file (JPG, PNG, WEBP, GIF, AVIF).');
      if (e.target) e.target.value = '';
      return;
    }

    setUploadingImage(true);
    try {
      const { dataUrl, contentType } = await compressImageFile(file);
      const base64Data = dataUrl.includes('base64,') ? dataUrl.split('base64,')[1] : dataUrl;

      const res = await apiRequest('/api/admin/upload-image', {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          content_type: contentType || file.type || 'image/jpeg',
          data: base64Data,
        }),
      });

      if (res && res.url) {
        setFormData((prev) => ({ ...prev, image: res.url }));
        showToast('Image uploaded successfully! 📸');
      } else {
        throw new Error('Upload returned no URL');
      }
    } catch (err) {
      showToast(err.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
      if (e.target) e.target.value = '';
    }
  };

  // Handle Download from Web Image URL
  const handleFetchImageUrl = async (rawUrl) => {
    const targetUrl = (rawUrl || '').trim();
    if (!targetUrl || targetUrl.startsWith('/uploads/') || targetUrl.startsWith('data:')) {
      return;
    }
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      return;
    }

    setFetchingUrl(true);
    try {
      // 1. Try backend server download first
      const res = await apiRequest('/api/admin/fetch-image-url', {
        method: 'POST',
        body: JSON.stringify({ url: targetUrl }),
      });

      if (res && res.url) {
        setFormData((prev) => ({ ...prev, image: res.url }));
        showToast('Web image downloaded & saved to server! 📸');
        return;
      }
    } catch (err) {
      console.warn('Backend image fetch failed, attempting client-side fallback:', err.message);
    }

    // 2. Client-side browser fetch/canvas fallback
    try {
      const response = await fetch(targetUrl, { mode: 'cors' });
      if (response.ok) {
        const blob = await response.blob();
        const { dataUrl, contentType } = await compressImageFile(
          new File([blob], 'web_image.jpg', { type: blob.type || 'image/jpeg' })
        );
        const base64Data = dataUrl.includes('base64,') ? dataUrl.split('base64,')[1] : dataUrl;

        const uploadRes = await apiRequest('/api/admin/upload-image', {
          method: 'POST',
          body: JSON.stringify({
            filename: 'web_image.jpg',
            content_type: contentType || 'image/jpeg',
            data: base64Data,
          }),
        });

        if (uploadRes && uploadRes.url) {
          setFormData((prev) => ({ ...prev, image: uploadRes.url }));
          showToast('Web image captured & saved to server! 📸');
          return;
        }
      }
    } catch (clientErr) {
      console.warn('Client fallback also failed:', clientErr.message);
    } finally {
      setFetchingUrl(false);
    }
  };

  // Submit / Save Event
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast('Please enter an event title.');
      return;
    }

    // Validate event date: minimum today, maximum 1 year from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setFullYear(today.getFullYear() + 1);
    maxDate.setHours(23, 59, 59, 999);

    const eventDate = new Date((formData.date || '') + 'T00:00:00');
    if (isNaN(eventDate.getTime()) || eventDate < today) {
      showToast('Event date cannot be in the past.');
      return;
    }
    if (eventDate > maxDate) {
      showToast('Event date cannot be more than 1 year from today.');
      return;
    }

    setSavingEvent(true);
    try {
      const cleanTitle = formData.title.trim();
      const generatedSlug = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const rawSlug = formData.slug?.trim() ? formData.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : generatedSlug;

      const selectedState = formData.state || 'Maharashtra';
      const selectedCity = formData.city || 'Pune';
      const finalLocation = (
        formData.location ||
        formatLocationString(selectedCity, selectedState)
      ).trim();

      let finalImage = (formData.image || '').trim();
      if ((finalImage.startsWith('http://') || finalImage.startsWith('https://')) && !finalImage.startsWith('/uploads/')) {
        try {
          const res = await apiRequest('/api/admin/fetch-image-url', {
            method: 'POST',
            body: JSON.stringify({ url: finalImage }),
          });
          if (res && res.url) {
            finalImage = res.url;
            setFormData((prev) => ({ ...prev, image: res.url }));
          }
        } catch (_) {}
      }

      const payload = {
        title: cleanTitle,
        slug: rawSlug || `event-${Date.now().toString(36)}`,
        type: formData.type,
        event_type: formData.type,
        category: formData.category,
        venue: formData.venue.trim(),
        state: selectedState,
        city: selectedCity,
        location: finalLocation,
        time: `${formData.date} ${formData.clock}`,
        price: formData.price === '' || formData.price === null || formData.price === undefined ? 0 : Math.max(0, Number(formData.price) || 0),
        image: finalImage,
        description: formData.description.trim(),
        day: 'weekend',
      };

      if (editingEvent) {
        await apiRequest(`/api/admin/events/${editingEvent.id || editingEvent.slug}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Event updated successfully! ✨');
      } else {
        await apiRequest('/api/admin/events', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('New event created and published! 🎉');
      }

      try {
        sessionStorage.removeItem('MAXSHOW_EVENTS_CACHE');
      } catch (_) {}

      if (onSuccess) {
        await onSuccess();
      }
      if (onClose) {
        onClose();
      }
    } catch (err) {
      showToast(err.message || 'Failed to save event');
    } finally {
      setSavingEvent(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto overscroll-contain modal-scroll-contain rounded-[2.5rem] bg-white shadow-2xl dark:bg-[#1c2733] border border-stone-200 dark:border-slate-700 animate-in zoom-in-95 duration-150 p-6 sm:p-8 space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-3 dark:border-slate-700">
          <h3 className="text-xl font-black text-ink dark:text-white">
            {editingEvent ? 'Edit Event Listing' : 'Create New Event Listing'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-stone-100 hover:text-ink dark:hover:bg-slate-800 dark:hover:text-white transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="grid gap-3.5 sm:grid-cols-2 text-xs sm:text-sm">
          {/* Event Title */}
          <div className="sm:col-span-2">
            <label className="mb-1 block font-bold text-ink dark:text-slate-200">Event Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Moonlight Picnic & Vinyl"
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white"
              required
            />
          </div>

          {/* Event Type Label */}
          <div>
            <label className="mb-1 block font-bold text-ink dark:text-slate-200">Event Type Label</label>
            <input
              type="text"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              placeholder="Live music"
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white"
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="mb-1 block font-bold text-ink dark:text-slate-200">Category</label>
            <CategoryDropdown
              value={formData.category}
              onChange={(val) => setFormData({ ...formData, category: val })}
            />
          </div>

          {/* Venue / Location Name */}
          <div className="sm:col-span-2">
            <label className="mb-1 block font-bold text-ink dark:text-slate-200">Venue / Location Name *</label>
            <input
              type="text"
              value={formData.venue}
              onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
              placeholder="e.g. Skyline Terrace, Hard Rock Cafe, Phoenix Marketcity..."
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white shadow-xs"
              required
            />
          </div>

          {/* State Dropdown */}
          <div>
            <label className="mb-1 block font-bold text-ink dark:text-slate-200">State *</label>
            <StateDropdown
              value={formData.state || 'Maharashtra'}
              onChange={(selectedState) => {
                const defaultCities = getCitiesForState(selectedState);
                const firstCity = defaultCities[0] || '';
                setFormData((prev) => ({
                  ...prev,
                  state: selectedState,
                  city: firstCity,
                  location: formatLocationString(firstCity, selectedState),
                }));
              }}
              placeholder="Select State..."
              required
            />
          </div>

          {/* City Dropdown */}
          <div>
            <label className="mb-1 block font-bold text-ink dark:text-slate-200">City *</label>
            <CityDropdown
              state={formData.state || 'Maharashtra'}
              value={formData.city || ''}
              onChange={(selectedCity) => {
                setFormData((prev) => ({
                  ...prev,
                  city: selectedCity,
                  location: formatLocationString(selectedCity, prev.state || 'Maharashtra'),
                }));
              }}
              placeholder={`Select city in ${formData.state || 'Maharashtra'}`}
              required
            />
          </div>

          {/* Event Date */}
          <div>
            <label className="mb-1 block font-bold text-ink dark:text-slate-200">Date</label>
            <CustomDatePicker
              value={formData.date}
              onChange={(val) => setFormData({ ...formData, date: val })}
              placeholder="Select event date"
              required
            />
          </div>

          {/* Event Time */}
          <div>
            <label className="mb-1 block font-bold text-ink dark:text-slate-200">Time</label>
            <CustomTimePicker
              value={formData.clock}
              onChange={(val) => setFormData({ ...formData, clock: val })}
              placeholder="Select event time"
              required
            />
          </div>

          {/* Price */}
          <div className="sm:col-span-2">
            <label className="mb-1 block font-bold text-ink dark:text-slate-200">Price (INR, 0 for Free)</label>
            <input
              type="number"
              min="0"
              value={formData.price === '' ? '' : formData.price}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setFormData({ ...formData, price: '' });
                } else {
                  const cleaned = val.replace(/^0+(?=\d)/, '');
                  const num = parseInt(cleaned, 10);
                  setFormData({ ...formData, price: isNaN(num) ? '' : Math.max(0, num) });
                }
              }}
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white"
              placeholder="0 (Free entry)"
            />
          </div>

          {/* Cover Image Upload & Live Preview */}
          <div className="sm:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block font-bold text-ink dark:text-slate-200">Event Cover Image *</label>
              {uploadingImage ? (
                <span className="text-xs font-bold text-coral animate-pulse">Compressing & Uploading image... 📸</span>
              ) : fetchingUrl ? (
                <span className="text-xs font-bold text-coral animate-pulse">Downloading image from web... 🌐⏳</span>
              ) : null}
            </div>

            {/* Preview Banner or Dropzone */}
            {formData.image ? (
              <div className="relative h-44 w-full overflow-hidden rounded-2xl border border-stone-200 dark:border-slate-700 bg-stone-900 group shadow-sm">
                <img
                  src={formData.image}
                  alt="Event Cover Preview"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80';
                  }}
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-ink shadow-sm hover:bg-stone-100 transition cursor-pointer"
                  >
                    Change Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, image: '' }))}
                    className="rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-red-700 transition cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer rounded-2xl border-2 border-dashed border-stone-300 dark:border-slate-700 p-6 text-center hover:border-coral transition dark:bg-[#101820]"
              >
                <span className="text-3xl">📷</span>
                <p className="mt-2 text-xs sm:text-sm font-bold text-ink dark:text-white">
                  {uploadingImage ? 'Uploading photo...' : fetchingUrl ? 'Downloading image from web...' : 'Click to choose event image from your device'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Supports JPG, PNG, WEBP, GIF, AVIF or paste any web link below</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.avif,.bmp"
              onChange={handleImageFileChange}
              className="hidden"
            />

            {/* Upload Action or URL Paste */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage || fetchingUrl}
                className="rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:border-coral hover:text-coral transition dark:border-slate-700 dark:bg-[#101820] dark:text-slate-300 disabled:opacity-50 shrink-0 cursor-pointer"
              >
                {uploadingImage ? 'Uploading...' : '📁 Upload from Device'}
              </button>
              <div className="relative flex-1 flex items-center">
                <input
                  type="text"
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text')?.trim();
                    if (pasted && (pasted.startsWith('http://') || pasted.startsWith('https://'))) {
                      setFormData((prev) => ({ ...prev, image: pasted }));
                      setTimeout(() => handleFetchImageUrl(pasted), 80);
                    }
                  }}
                  onBlur={() => {
                    if (formData.image.startsWith('http://') || formData.image.startsWith('https://')) {
                      handleFetchImageUrl(formData.image);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (formData.image.startsWith('http://') || formData.image.startsWith('https://')) {
                        handleFetchImageUrl(formData.image);
                      }
                    }
                  }}
                  placeholder="Paste any image link from internet (https://...)"
                  className="w-full rounded-xl border border-stone-300 pl-3.5 pr-20 py-2 text-xs font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                />
                {Boolean(formData.image && (formData.image.startsWith('http://') || formData.image.startsWith('https://')) && !formData.image.startsWith('/uploads/')) && (
                  <button
                    type="button"
                    onClick={() => handleFetchImageUrl(formData.image)}
                    disabled={fetchingUrl}
                    className="absolute right-1.5 rounded-lg bg-coral px-2.5 py-1 text-[11px] font-bold text-white shadow-sm hover:brightness-110 transition disabled:opacity-50 cursor-pointer"
                    title="Download and save this web image to server"
                  >
                    {fetchingUrl ? '⏳' : '⬇️ Attach'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="sm:col-span-2">
            <label className="mb-1 block font-bold text-ink dark:text-slate-200">Description</label>
            <textarea
              rows="3"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Tell people what to expect..."
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white"
            ></textarea>
          </div>

          {/* Form Actions */}
          <div className="sm:col-span-2 grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl border border-stone-300 bg-white py-3 font-bold text-slate-700 hover:bg-stone-50 transition dark:border-slate-700 dark:bg-[#101820] dark:text-slate-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              disabled={savingEvent}
              type="submit"
              className="w-full rounded-2xl bg-coral py-3 font-bold text-white shadow-md hover:bg-[#df503c] transition disabled:opacity-50 cursor-pointer"
            >
              {savingEvent ? 'Saving...' : editingEvent ? 'Update Event' : 'Publish Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEvents;
