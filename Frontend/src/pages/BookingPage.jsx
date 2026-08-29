import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { apiRequest } from '../utils/api';
import { FALLBACK_EVENTS } from '../utils/constants';
import { formatPrice, formatEventTime, formatBookingDateTime } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { loadRazorpay } from '../utils/razorpay';

export const BookingPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const slug = searchParams.get('event') || 'moonlight-picnic';
  const quantity = Math.max(1, parseInt(searchParams.get('quantity') || '1', 10));

  const [event, setEvent] = useState(() => FALLBACK_EVENTS[slug] || Object.values(FALLBACK_EVENTS)[0]);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  // If user is not authenticated, redirect directly to Login page with redirect back
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      const redirectTarget = `/booking?event=${encodeURIComponent(slug)}&quantity=${quantity}`;
      showToast('Please sign in to book tickets.');
      navigate(`/user?redirect=${encodeURIComponent(redirectTarget)}`, { replace: true });
    }
  }, [authLoading, isAuthenticated, slug, quantity, navigate, showToast]);

  useEffect(() => {
    apiRequest(`/api/events/${encodeURIComponent(slug)}`)
      .then((data) => {
        if (data && data.event) {
          setEvent(data.event);
        }
      })
      .catch(() => {
        if (FALLBACK_EVENTS[slug]) {
          setEvent(FALLBACK_EVENTS[slug]);
        }
      })
      .finally(() => setLoadingEvent(false));
  }, [slug]);

  const unitPrice = Number(event.price) || 0;
  const totalPrice = unitPrice * quantity;
  const isFree = totalPrice === 0;
  const timeFormatted = formatEventTime(event.time || '', event.day);

  const handleConfirmBooking = async () => {
    if (!isAuthenticated) {
      const redirectTarget = `/booking?event=${encodeURIComponent(slug)}&quantity=${quantity}`;
      navigate(`/user?redirect=${encodeURIComponent(redirectTarget)}`);
      return;
    }

    setProcessing(true);

    const bookingPayload = {
      event_id: Number(event.id) || null,
      event_slug: slug,
      title: event.title || 'Event Booking',
      location: event.location || event.venue || 'Hinjawadi, Pune',
      time: event.time || 'TBA',
      price: unitPrice,
      quantity,
      guest_name: user?.name || '',
      guest_email: user?.email || '',
      guest_phone: user?.phone || '',
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
    };

    // Free Ticket Flow
    if (isFree) {
      try {
        const res = await apiRequest('/api/payment/create-order', {
          method: 'POST',
          body: JSON.stringify(bookingPayload),
        });

        setConfirmedBooking({
          booking_code: res.booking_id || 'BKG-CONFIRMED',
          title: event.title,
          time: event.time,
          location: event.location || event.venue,
          tickets: quantity,
          total: 0,
          booking_date: new Date().toISOString(),
        });
        showToast('Reservation confirmed! 🎉');
      } catch (err) {
        showToast(err.message || 'Failed to complete reservation');
      } finally {
        setProcessing(false);
      }
      return;
    }

    // Paid Ticket via Razorpay
    try {
      setProcessing(true);
      const isLoaded = await loadRazorpay();
      if (!isLoaded || !window.Razorpay) {
        showToast('Payment system could not be loaded. Please check your internet connection.');
        setProcessing(false);
        return;
      }

      const orderData = await apiRequest('/api/payment/create-order', {
        method: 'POST',
        body: JSON.stringify(bookingPayload),
      });

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'MAXSHOW Events',
        description: `${quantity}x ${event.title}`,
        image: '/logo.png',
        order_id: orderData.order_id,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        theme: {
          color: '#F2634E',
        },
        handler: async (response) => {
          try {
            const verifyRes = await apiRequest('/api/payment/verify', {
              method: 'POST',
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                ...bookingPayload,
              }),
            });

            setConfirmedBooking({
              booking_code: verifyRes.booking_id || 'BKG-PAID',
              title: event.title,
              time: event.time,
              location: event.location || event.venue,
              tickets: quantity,
              total: totalPrice,
              payment_id: response.razorpay_payment_id,
              booking_date: new Date().toISOString(),
            });
            showToast('Payment verified & booking confirmed! 🎟️');
          } catch (vErr) {
            showToast(vErr.message || 'Payment verification failed');
          } finally {
            setProcessing(false);
          }
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            showToast('Payment cancelled');
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      showToast(err.message || 'Failed to initiate checkout');
      setProcessing(false);
    }
  };

  if (authLoading || (!isAuthenticated && !confirmedBooking)) {
    return (
      <div className="min-h-screen bg-cream text-ink dark:bg-[#101820] dark:text-white flex flex-col justify-between">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <span className="h-8 w-8 inline-block rounded-full border-4 border-coral border-t-transparent animate-spin"></span>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
              Redirecting to sign in...
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream text-ink dark:bg-[#101820] dark:text-white flex flex-col">
      <Navbar />

      <main className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-8 flex-1">
        {/* Success Confirmation View */}
        {confirmedBooking ? (
          <div className="mx-auto w-full max-w-2xl rounded-3xl bg-white p-5 sm:p-7 shadow-soft dark:bg-[#1c2733] border border-stone-200/80 dark:border-slate-700 space-y-4 animate-in zoom-in-95 duration-200">
            {/* Top Compact Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-stone-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-100 text-xl text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 shrink-0">
                  ✓
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-ink dark:text-white">
                      You're all set!
                    </h2>
                    <span className="inline-block rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                      Confirmed
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Your digital ticket is ready and linked to your booking code.
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline-flex rounded-full bg-coral/10 dark:bg-coral/20 px-3 py-1 text-xs font-mono font-bold text-coral border border-coral/20">
                #{confirmedBooking.booking_code}
              </span>
            </div>

            {/* Split Content: QR Code (Left) + Ticket Details (Right) */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              {/* QR Code Container (5 cols) */}
              <div className="sm:col-span-5 flex flex-col items-center justify-center p-3.5 rounded-2xl bg-stone-50 dark:bg-[#151f2b] border border-stone-100 dark:border-slate-800 text-center">
                <div className="p-2 bg-white rounded-2xl shadow-sm border border-stone-200">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
                      confirmedBooking.booking_code
                    )}`}
                    alt="Ticket QR Code"
                    className="h-28 w-28 sm:h-32 sm:w-32 object-contain"
                  />
                </div>
                <p className="mt-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Scan at venue entrance
                </p>
                <span className="mt-0.5 sm:hidden font-mono text-xs font-bold text-coral">
                  #{confirmedBooking.booking_code}
                </span>
              </div>

              {/* Ticket Details (7 cols) */}
              <div className="sm:col-span-7 space-y-2 text-xs">
                <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#151f2b] border border-stone-100 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Experience</p>
                      <h3 className="font-black text-sm text-ink dark:text-white line-clamp-1">
                        {confirmedBooking.title}
                      </h3>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase shrink-0 ${
                        confirmedBooking.total === 0
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      }`}
                    >
                      {confirmedBooking.total === 0 ? 'Free Pass' : 'Paid'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-200/60 dark:border-slate-800 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Date & Time</span>
                      <span className="font-bold text-ink dark:text-slate-200">
                        {formatBookingDateTime(confirmedBooking.booking_date || new Date())}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Location</span>
                      <span className="font-bold text-ink dark:text-slate-200 truncate block" title={confirmedBooking.location}>
                        {confirmedBooking.location || 'MAXSHOW Venue'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Passes Reserved</span>
                      <span className="font-bold text-ink dark:text-slate-200">
                        {confirmedBooking.tickets} Ticket{confirmedBooking.tickets > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Total Amount</span>
                      <span className="font-bold text-coral">
                        {confirmedBooking.total === 0 ? 'Free Entry (₹0)' : formatPrice(confirmedBooking.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-2.5 pt-3 border-t border-stone-100 dark:border-slate-800">
              <Link
                to="/"
                className="rounded-xl border border-stone-300 bg-white px-5 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:bg-stone-50 transition text-center dark:border-slate-700 dark:bg-[#101820] dark:text-slate-300"
              >
                Back to Home
              </Link>
              <Link
                to="/dashboard"
                className="rounded-xl bg-coral px-5 py-2 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-[#df503c] transition text-center"
              >
                View in Dashboard →
              </Link>
            </div>
          </div>
        ) : (
          /* Checkout Summary & Confirmation */
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
            {/* Left: Attendee Details */}
            <div className="space-y-6">
              <div className="rounded-[2.5rem] bg-white p-6 sm:p-8 shadow-soft dark:bg-[#1c2733] border border-stone-200/80 dark:border-slate-700 space-y-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-coral">Attendee Information</p>
                  <h2 className="mt-1 text-2xl font-black text-ink dark:text-white">Ticket Holder</h2>
                </div>

                <div className="flex items-center gap-4 rounded-2xl bg-stone-50 p-4 dark:bg-[#151f2b] border border-stone-200 dark:border-slate-700 shadow-sm">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-coral text-base font-black text-white shadow-sm">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h4 className="font-bold text-ink dark:text-white text-base">{user?.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {user?.email} {user?.phone ? `· +91 ${user?.phone}` : ''}
                    </p>
                    <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      ✓ Verified Account Holder
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Order Summary Card */}
            <div className="space-y-6">
              <div className="rounded-[2.5rem] bg-white p-6 sm:p-8 shadow-soft dark:bg-[#1c2733] border border-stone-200/80 dark:border-slate-700 space-y-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-coral">Order Summary</p>
                  <h3 className="mt-1 text-xl sm:text-2xl font-black text-ink dark:text-white">{event.title}</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    📍 {event.venue || event.location} · 🕒 {timeFormatted}
                  </p>
                </div>

                <div className="divide-y divide-stone-100 dark:divide-slate-700 text-xs sm:text-sm">
                  <div className="flex justify-between py-2.5">
                    <span className="text-slate-500 dark:text-slate-400">Ticket Quantity</span>
                    <span className="font-bold text-ink dark:text-white">{quantity}x pass{quantity > 1 ? 'es' : ''}</span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-slate-500 dark:text-slate-400">Price per ticket</span>
                    <span className="font-bold text-ink dark:text-white">{formatPrice(unitPrice)}</span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-slate-500 dark:text-slate-400">Booking Fee</span>
                    <span className="font-bold text-emerald-600">₹0 (Waived)</span>
                  </div>
                  <div className="flex justify-between pt-4 text-base font-black text-ink dark:text-white">
                    <span>Total</span>
                    <span className="text-coral">{isFree ? 'Free entry' : formatPrice(totalPrice)}</span>
                  </div>
                </div>

                <button
                  disabled={processing}
                  onClick={handleConfirmBooking}
                  className="w-full rounded-2xl bg-coral py-4 text-sm sm:text-base font-bold text-white shadow-lg shadow-coral/25 hover:bg-[#df503c] transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  {processing ? (
                    'Processing booking...'
                  ) : isFree ? (
                    'Claim Free Pass →'
                  ) : (
                    `Pay ${formatPrice(totalPrice)} with Razorpay →`
                  )}
                </button>

                <p className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                  <span>🔒</span>
                  <span>Verified &amp; Secured with 256-bit SSL encryption.</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};
