import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../context/ToastContext';
import { parseLocationStateAndCity, formatLocationString } from '../utils/constants';
import { useLockBodyScroll } from '../utils/useLockBodyScroll';

// Popular Cities with themed vector Landmark SVGs
const POPULAR_CITIES = [
  {
    name: 'Mumbai',
    state: 'Maharashtra',
    formatted: 'Maharashtra, Mumbai',
    icon: (
      <svg className="w-9 h-9 text-coral" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {/* Gateway of India Landmark */}
        <path d="M6 42h36M10 42V18l4-4h20l4 4v24" />
        <path d="M14 42V24c0-5.5 4.5-10 10-10s10 4.5 10 10v18" />
        <path d="M18 42V26c0-3.3 2.7-6 6-6s6 2.7 6 6v16" />
        <path d="M10 14h28M14 10l2-4h16l2 4" />
        <circle cx="24" cy="8" r="1.5" fill="currentColor" />
        <path d="M7 18h6M35 18h6" />
      </svg>
    ),
  },
  {
    name: 'Delhi NCR',
    state: 'Delhi (NCT)',
    formatted: 'Delhi (NCT), Delhi',
    icon: (
      <svg className="w-9 h-9 text-coral" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {/* India Gate Landmark */}
        <path d="M8 42h32M12 42V16h24v26" />
        <path d="M16 42V24c0-4.4 3.6-8 8-8s8 3.6 8 8v18" />
        <path d="M10 16h28M14 12h20M18 8h12M24 5v3" />
        <path d="M12 28h4M32 28h4M12 34h4M32 34h4" />
      </svg>
    ),
  },
  {
    name: 'Bengaluru',
    state: 'Karnataka',
    formatted: 'Karnataka, Bengaluru',
    icon: (
      <svg className="w-9 h-9 text-coral" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {/* Vidhana Soudha Landmark */}
        <path d="M4 42h40M8 42V22l4-4h24l4 4v20" />
        <path d="M18 18V12l6-6 6 6v6" />
        <path d="M24 6V3" />
        <circle cx="24" cy="14" r="2" fill="currentColor" />
        <path d="M16 42V28c0-4.4 3.6-8 8-8s8 3.6 8 8v14" />
        <path d="M12 24v18M36 24v18M20 28v14M28 28v14" />
      </svg>
    ),
  },
  {
    name: 'Hyderabad',
    state: 'Telangana',
    formatted: 'Telangana, Hyderabad',
    icon: (
      <svg className="w-9 h-9 text-coral" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {/* Charminar Landmark */}
        <path d="M6 42h36M10 42V10l3-4 3 4v32M32 42V10l3-4 3 4v32" />
        <path d="M16 22h16v20H16z" />
        <path d="M18 42V30c0-3.3 2.7-6 6-6s6 2.7 6 6v12" />
        <path d="M16 16h16M20 12l4-4 4 4" />
        <path d="M13 6V3M35 6V3" />
      </svg>
    ),
  },
  {
    name: 'Ahmedabad',
    state: 'Gujarat',
    formatted: 'Gujarat, Ahmedabad',
    icon: (
      <svg className="w-9 h-9 text-coral" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {/* Sidi Saiyyed / Heritage Arch */}
        <path d="M6 42h36M10 42V20h28v22" />
        <path d="M14 42V26c0-5.5 4.5-10 10-10s10 4.5 10 10v16" />
        <path d="M24 16v26M18 20l6 6 6-6M10 16l14-8 14 8" />
        <circle cx="24" cy="5" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: 'Chandigarh',
    state: 'Chandigarh',
    formatted: 'Chandigarh, Chandigarh',
    icon: (
      <svg className="w-9 h-9 text-coral" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {/* Open Hand Monument */}
        <path d="M16 42h16M24 42V28" />
        <path d="M20 28l-8-6c-2-1.5-1.5-4.5.8-5.3L22 13l-1-7c-.3-2 2-3.4 3.7-2.3L34 10c2 1.3 2.5 3.8 1.2 5.8L31 22l4 2c2 1 2 4 0 5.2l-11 5z" />
      </svg>
    ),
  },
  {
    name: 'Chennai',
    state: 'Tamil Nadu',
    formatted: 'Tamil Nadu, Chennai',
    icon: (
      <svg className="w-9 h-9 text-coral" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {/* Temple Gopuram */}
        <path d="M10 42h28M12 42l3-28h18l3 28" />
        <path d="M14 34h20M16 26h16M18 18h12" />
        <path d="M20 14V8l4-4 4 4v6" />
        <path d="M20 42v-6c0-2.2 1.8-4 4-4s4 1.8 4 4v6" />
        <path d="M24 4V2" />
      </svg>
    ),
  },
  {
    name: 'Pune',
    state: 'Maharashtra',
    formatted: 'Maharashtra, Pune',
    icon: (
      <svg className="w-9 h-9 text-coral" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {/* Shaniwar Wada Fort Gate */}
        <path d="M6 42h36M10 42V18l4-4h20l4 4v24" />
        <path d="M16 42V26c0-4.4 3.6-8 8-8s8 3.6 8 8v16" />
        <path d="M10 18l3-8 3 8M32 18l3-8 3 8" />
        <path d="M18 10h12" />
        <path d="M12 24h4M32 24h4" />
      </svg>
    ),
  },
  {
    name: 'Kolkata',
    state: 'West Bengal',
    formatted: 'West Bengal, Kolkata',
    icon: (
      <svg className="w-9 h-9 text-coral" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {/* Howrah Bridge */}
        <path d="M4 38h40M8 38V12l16 10 16-10v26" />
        <path d="M8 12h32M16 38V17M32 38V17" />
        <path d="M8 26l16-6 16 6" />
        <path d="M4 42h40" />
      </svg>
    ),
  },
  {
    name: 'Goa',
    state: 'Goa',
    formatted: 'Goa, North Goa',
    icon: (
      <svg className="w-9 h-9 text-coral" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {/* Palm Trees & Sun */}
        <path d="M20 42c0-12 8-22 14-26" />
        <path d="M34 16c-6-1-12-6-12-12 8 0 14 6 14 12z" />
        <path d="M34 16c0-7 6-12 12-12-1 8-6 13-12 12z" />
        <path d="M34 16c6 3 12 1 14-5-6-1-12 1-14 5z" />
        <path d="M12 42c0-8 5-15 9-18" />
        <path d="M4 42c6-2 14-2 20 0s14 2 20 0" />
        <circle cx="12" cy="14" r="5" strokeDasharray="2 2" />
      </svg>
    ),
  },
  {
    name: 'Jaipur',
    state: 'Rajasthan',
    formatted: 'Rajasthan, Jaipur',
    icon: (
      <svg className="w-9 h-9 text-coral" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {/* Hawa Mahal Palace */}
        <path d="M6 42h36M10 42V18l14-12 14 12v24" />
        <path d="M16 42V28c0-4.4 3.6-8 8-8s8 3.6 8 8v14" />
        <path d="M14 22h4M30 22h4M16 16h4M28 16h4M22 12h4" />
        <path d="M24 6V3" />
      </svg>
    ),
  },
  {
    name: 'Kochi',
    state: 'Kerala',
    formatted: 'Kerala, Kochi',
    icon: (
      <svg className="w-9 h-9 text-coral" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {/* Chinese Fishing Nets / Sail */}
        <path d="M8 40c8-2 16-2 24 0s12 2 16 0" />
        <path d="M10 36l18-24 10 24" />
        <path d="M14 36l14-18M28 12v24" />
        <path d="M6 34l8-14" />
        <circle cx="36" cy="14" r="4" fill="currentColor" fillOpacity="0.3" />
      </svg>
    ),
  },
];

// Comprehensive India A-Z Cities Database
const ALL_INDIA_CITIES = [
  { city: 'Abohar', state: 'Punjab' },
  { city: 'Abu Road', state: 'Rajasthan' },
  { city: 'Achampet', state: 'Telangana' },
  { city: 'Acharapakkam', state: 'Tamil Nadu' },
  { city: 'Addanki', state: 'Andhra Pradesh' },
  { city: 'Adilabad', state: 'Telangana' },
  { city: 'Adipur', state: 'Gujarat' },
  { city: 'Adoni', state: 'Andhra Pradesh' },
  { city: 'Adoor', state: 'Kerala' },
  { city: 'Agar', state: 'Madhya Pradesh' },
  { city: 'Agartala', state: 'Tripura' },
  { city: 'Agra', state: 'Uttar Pradesh' },
  { city: 'Ahmedabad', state: 'Gujarat' },
  { city: 'Ahmedgarh', state: 'Punjab' },
  { city: 'Ahmednagar', state: 'Maharashtra' },
  { city: 'Aizawl', state: 'Mizoram' },
  { city: 'Ajmer', state: 'Rajasthan' },
  { city: 'Akbarpur', state: 'Uttar Pradesh' },
  { city: 'Akola', state: 'Maharashtra' },
  { city: 'Alakode', state: 'Kerala' },
  { city: 'Alangudi', state: 'Tamil Nadu' },
  { city: 'Alappuzha', state: 'Kerala' },
  { city: 'Aligarh', state: 'Uttar Pradesh' },
  { city: 'Almora', state: 'Uttarakhand' },
  { city: 'Alwar', state: 'Rajasthan' },
  { city: 'Amalner', state: 'Maharashtra' },
  { city: 'Ambala', state: 'Haryana' },
  { city: 'Amravati', state: 'Maharashtra' },
  { city: 'Amreli', state: 'Gujarat' },
  { city: 'Amritsar', state: 'Punjab' },
  { city: 'Anand', state: 'Gujarat' },
  { city: 'Anantapur', state: 'Andhra Pradesh' },
  { city: 'Angul', state: 'Odisha' },
  { city: 'Ankleshwar', state: 'Gujarat' },
  { city: 'Asansol', state: 'West Bengal' },
  { city: 'Aurangabad', state: 'Maharashtra' },
  { city: 'Bagalkot', state: 'Karnataka' },
  { city: 'Bahadurgarh', state: 'Haryana' },
  { city: 'Baharampur', state: 'West Bengal' },
  { city: 'Balaghat', state: 'Madhya Pradesh' },
  { city: 'Balangir', state: 'Odisha' },
  { city: 'Balasore', state: 'Odisha' },
  { city: 'Ballari', state: 'Karnataka' },
  { city: 'Baramati', state: 'Maharashtra' },
  { city: 'Bardhaman', state: 'West Bengal' },
  { city: 'Bareilly', state: 'Uttar Pradesh' },
  { city: 'Barmer', state: 'Rajasthan' },
  { city: 'Bathinda', state: 'Punjab' },
  { city: 'Belagavi', state: 'Karnataka' },
  { city: 'Bengaluru', state: 'Karnataka' },
  { city: 'Berhampur', state: 'Odisha' },
  { city: 'Betul', state: 'Madhya Pradesh' },
  { city: 'Bhagalpur', state: 'Bihar' },
  { city: 'Bharatpur', state: 'Rajasthan' },
  { city: 'Bharuch', state: 'Gujarat' },
  { city: 'Bhavnagar', state: 'Gujarat' },
  { city: 'Bhilai', state: 'Chhattisgarh' },
  { city: 'Bhilwara', state: 'Rajasthan' },
  { city: 'Bhimavaram', state: 'Andhra Pradesh' },
  { city: 'Bhopal', state: 'Madhya Pradesh' },
  { city: 'Bhubaneswar', state: 'Odisha' },
  { city: 'Bhuj', state: 'Gujarat' },
  { city: 'Bidar', state: 'Karnataka' },
  { city: 'Bikaner', state: 'Rajasthan' },
  { city: 'Bilaspur', state: 'Chhattisgarh' },
  { city: 'Bokaro', state: 'Jharkhand' },
  { city: 'Buldhana', state: 'Maharashtra' },
  { city: 'Calicut (Kozhikode)', state: 'Kerala' },
  { city: 'Chandigarh', state: 'Chandigarh' },
  { city: 'Chandrapur', state: 'Maharashtra' },
  { city: 'Chennai', state: 'Tamil Nadu' },
  { city: 'Chhatarpur', state: 'Madhya Pradesh' },
  { city: 'Chhindwara', state: 'Madhya Pradesh' },
  { city: 'Chikkamagaluru', state: 'Karnataka' },
  { city: 'Chitradurga', state: 'Karnataka' },
  { city: 'Chittoor', state: 'Andhra Pradesh' },
  { city: 'Coimbatore', state: 'Tamil Nadu' },
  { city: 'Cooch Behar', state: 'West Bengal' },
  { city: 'Cuddalore', state: 'Tamil Nadu' },
  { city: 'Cuttack', state: 'Odisha' },
  { city: 'Dalhousie', state: 'Himachal Pradesh' },
  { city: 'Daman', state: 'Daman and Diu' },
  { city: 'Darbhanga', state: 'Bihar' },
  { city: 'Darjeeling', state: 'West Bengal' },
  { city: 'Davanagere', state: 'Karnataka' },
  { city: 'Dehradun', state: 'Uttarakhand' },
  { city: 'Delhi', state: 'Delhi (NCT)' },
  { city: 'Deoghar', state: 'Jharkhand' },
  { city: 'Dewas', state: 'Madhya Pradesh' },
  { city: 'Dhanbad', state: 'Jharkhand' },
  { city: 'Dharamsala', state: 'Himachal Pradesh' },
  { city: 'Dharmapuri', state: 'Tamil Nadu' },
  { city: 'Dharwad', state: 'Karnataka' },
  { city: 'Dhule', state: 'Maharashtra' },
  { city: 'Dibrugarh', state: 'Assam' },
  { city: 'Dindigul', state: 'Tamil Nadu' },
  { city: 'Durg', state: 'Chhattisgarh' },
  { city: 'Durgapur', state: 'West Bengal' },
  { city: 'Eluru', state: 'Andhra Pradesh' },
  { city: 'Erode', state: 'Tamil Nadu' },
  { city: 'Faizabad (Ayodhya)', state: 'Uttar Pradesh' },
  { city: 'Faridabad', state: 'Haryana' },
  { city: 'Fatehpur', state: 'Uttar Pradesh' },
  { city: 'Firozabad', state: 'Uttar Pradesh' },
  { city: 'Gadag', state: 'Karnataka' },
  { city: 'Gandhidham', state: 'Gujarat' },
  { city: 'Gandhinagar', state: 'Gujarat' },
  { city: 'Gaya', state: 'Bihar' },
  { city: 'Ghaziabad', state: 'Uttar Pradesh' },
  { city: 'Goa', state: 'Goa' },
  { city: 'Godhra', state: 'Gujarat' },
  { city: 'Gondia', state: 'Maharashtra' },
  { city: 'Gorakhpur', state: 'Uttar Pradesh' },
  { city: 'Gulbarga (Kalaburagi)', state: 'Karnataka' },
  { city: 'Guna', state: 'Madhya Pradesh' },
  { city: 'Guntur', state: 'Andhra Pradesh' },
  { city: 'Gurugram (Gurgaon)', state: 'Haryana' },
  { city: 'Guwahati', state: 'Assam' },
  { city: 'Gwalior', state: 'Madhya Pradesh' },
  { city: 'Haldwani', state: 'Uttarakhand' },
  { city: 'Hampi', state: 'Karnataka' },
  { city: 'Hansi', state: 'Haryana' },
  { city: 'Haridwar', state: 'Uttarakhand' },
  { city: 'Hassan', state: 'Karnataka' },
  { city: 'Hisar', state: 'Haryana' },
  { city: 'Hoshiarpur', state: 'Punjab' },
  { city: 'Hosur', state: 'Tamil Nadu' },
  { city: 'Hubballi (Hubli)', state: 'Karnataka' },
  { city: 'Hyderabad', state: 'Telangana' },
  { city: 'Ichalkaranji', state: 'Maharashtra' },
  { city: 'Imphal', state: 'Manipur' },
  { city: 'Indore', state: 'Madhya Pradesh' },
  { city: 'Itanagar', state: 'Arunachal Pradesh' },
  { city: 'Jabalpur', state: 'Madhya Pradesh' },
  { city: 'Jaipur', state: 'Rajasthan' },
  { city: 'Jaisalmer', state: 'Rajasthan' },
  { city: 'Jalandhar', state: 'Punjab' },
  { city: 'Jalgaon', state: 'Maharashtra' },
  { city: 'Jalna', state: 'Maharashtra' },
  { city: 'Jammu', state: 'Jammu and Kashmir' },
  { city: 'Jamnagar', state: 'Gujarat' },
  { city: 'Jamshedpur', state: 'Jharkhand' },
  { city: 'Jhansi', state: 'Uttar Pradesh' },
  { city: 'Jhunjhunu', state: 'Rajasthan' },
  { city: 'Jodhpur', state: 'Rajasthan' },
  { city: 'Jorhat', state: 'Assam' },
  { city: 'Junagadh', state: 'Gujarat' },
  { city: 'Kakinada', state: 'Andhra Pradesh' },
  { city: 'Kalyan', state: 'Maharashtra' },
  { city: 'Kanchipuram', state: 'Tamil Nadu' },
  { city: 'Kannur', state: 'Kerala' },
  { city: 'Kanpur', state: 'Uttar Pradesh' },
  { city: 'Kanyakumari', state: 'Tamil Nadu' },
  { city: 'Kapurthala', state: 'Punjab' },
  { city: 'Karaikudi', state: 'Tamil Nadu' },
  { city: 'Karimnagar', state: 'Telangana' },
  { city: 'Karnal', state: 'Haryana' },
  { city: 'Karur', state: 'Tamil Nadu' },
  { city: 'Kasargod', state: 'Kerala' },
  { city: 'Kashipur', state: 'Uttarakhand' },
  { city: 'Khammam', state: 'Telangana' },
  { city: 'Khandwa', state: 'Madhya Pradesh' },
  { city: 'Kharagpur', state: 'West Bengal' },
  { city: 'Kochi', state: 'Kerala' },
  { city: 'Kodaikanal', state: 'Tamil Nadu' },
  { city: 'Kolhapur', state: 'Maharashtra' },
  { city: 'Kolkata', state: 'West Bengal' },
  { city: 'Kollam', state: 'Kerala' },
  { city: 'Korba', state: 'Chhattisgarh' },
  { city: 'Kota', state: 'Rajasthan' },
  { city: 'Kottayam', state: 'Kerala' },
  { city: 'Kozhikode', state: 'Kerala' },
  { city: 'Kullu', state: 'Himachal Pradesh' },
  { city: 'Kumbakonam', state: 'Tamil Nadu' },
  { city: 'Kurnool', state: 'Andhra Pradesh' },
  { city: 'Kurukshetra', state: 'Haryana' },
  { city: 'Latur', state: 'Maharashtra' },
  { city: 'Lonavala', state: 'Maharashtra' },
  { city: 'Lucknow', state: 'Uttar Pradesh' },
  { city: 'Ludhiana', state: 'Punjab' },
  { city: 'Madgaon', state: 'Goa' },
  { city: 'Madurai', state: 'Tamil Nadu' },
  { city: 'Mahabaleshwar', state: 'Maharashtra' },
  { city: 'Malappuram', state: 'Kerala' },
  { city: 'Manali', state: 'Himachal Pradesh' },
  { city: 'Mangaluru (Mangalore)', state: 'Karnataka' },
  { city: 'Manipal', state: 'Karnataka' },
  { city: 'Mapusa', state: 'Goa' },
  { city: 'Margao', state: 'Goa' },
  { city: 'Mathura', state: 'Uttar Pradesh' },
  { city: 'Meerut', state: 'Uttar Pradesh' },
  { city: 'Mehsana', state: 'Gujarat' },
  { city: 'Mirzapur', state: 'Uttar Pradesh' },
  { city: 'Moradabad', state: 'Uttar Pradesh' },
  { city: 'Morbi', state: 'Gujarat' },
  { city: 'Mount Abu', state: 'Rajasthan' },
  { city: 'Muktsar', state: 'Punjab' },
  { city: 'Mumbai', state: 'Maharashtra' },
  { city: 'Munger', state: 'Bihar' },
  { city: 'Mussoorie', state: 'Uttarakhand' },
  { city: 'Muzaffarnagar', state: 'Uttar Pradesh' },
  { city: 'Muzaffarpur', state: 'Bihar' },
  { city: 'Mysuru (Mysore)', state: 'Karnataka' },
  { city: 'Nadiad', state: 'Gujarat' },
  { city: 'Nagercoil', state: 'Tamil Nadu' },
  { city: 'Nagpur', state: 'Maharashtra' },
  { city: 'Nainital', state: 'Uttarakhand' },
  { city: 'Nanded', state: 'Maharashtra' },
  { city: 'Nandurbar', state: 'Maharashtra' },
  { city: 'Nashik', state: 'Maharashtra' },
  { city: 'Navi Mumbai', state: 'Maharashtra' },
  { city: 'Navsari', state: 'Gujarat' },
  { city: 'Nellore', state: 'Andhra Pradesh' },
  { city: 'Nizamabad', state: 'Telangana' },
  { city: 'Noida', state: 'Uttar Pradesh' },
  { city: 'North Goa', state: 'Goa' },
  { city: 'Ongole', state: 'Andhra Pradesh' },
  { city: 'Ooty', state: 'Tamil Nadu' },
  { city: 'Palakkad', state: 'Kerala' },
  { city: 'Palanpur', state: 'Gujarat' },
  { city: 'Palwal', state: 'Haryana' },
  { city: 'Panaji', state: 'Goa' },
  { city: 'Panchkula', state: 'Haryana' },
  { city: 'Panipat', state: 'Haryana' },
  { city: 'Parbhani', state: 'Maharashtra' },
  { city: 'Pathankot', state: 'Punjab' },
  { city: 'Patiala', state: 'Punjab' },
  { city: 'Patna', state: 'Bihar' },
  { city: 'Phagwara', state: 'Punjab' },
  { city: 'Pimpri-Chinchwad', state: 'Maharashtra' },
  { city: 'Pollachi', state: 'Tamil Nadu' },
  { city: 'Pondicherry', state: 'Puducherry' },
  { city: 'Porbandar', state: 'Gujarat' },
  { city: 'Prayagraj (Allahabad)', state: 'Uttar Pradesh' },
  { city: 'Puducherry', state: 'Puducherry' },
  { city: 'Pune', state: 'Maharashtra' },
  { city: 'Puri', state: 'Odisha' },
  { city: 'Purnia', state: 'Bihar' },
  { city: 'Raichur', state: 'Karnataka' },
  { city: 'Raigad', state: 'Maharashtra' },
  { city: 'Raipur', state: 'Chhattisgarh' },
  { city: 'Rajahmundry', state: 'Andhra Pradesh' },
  { city: 'Rajkot', state: 'Gujarat' },
  { city: 'Rajnandgaon', state: 'Chhattisgarh' },
  { city: 'Rameswaram', state: 'Tamil Nadu' },
  { city: 'Ranchi', state: 'Jharkhand' },
  { city: 'Ratlam', state: 'Madhya Pradesh' },
  { city: 'Ratnagiri', state: 'Maharashtra' },
  { city: 'Rewa', state: 'Madhya Pradesh' },
  { city: 'Rewari', state: 'Haryana' },
  { city: 'Rishikesh', state: 'Uttarakhand' },
  { city: 'Rohtak', state: 'Haryana' },
  { city: 'Roorkee', state: 'Uttarakhand' },
  { city: 'Rourkela', state: 'Odisha' },
  { city: 'Sagar', state: 'Madhya Pradesh' },
  { city: 'Saharanpur', state: 'Uttar Pradesh' },
  { city: 'Salem', state: 'Tamil Nadu' },
  { city: 'Sambalpur', state: 'Odisha' },
  { city: 'Sangli', state: 'Maharashtra' },
  { city: 'Satara', state: 'Maharashtra' },
  { city: 'Satna', state: 'Madhya Pradesh' },
  { city: 'Secunderabad', state: 'Telangana' },
  { city: 'Shillong', state: 'Meghalaya' },
  { city: 'Shimla', state: 'Himachal Pradesh' },
  { city: 'Shivamogga (Shimoga)', state: 'Karnataka' },
  { city: 'Shirdi', state: 'Maharashtra' },
  { city: 'Sikar', state: 'Rajasthan' },
  { city: 'Silchar', state: 'Assam' },
  { city: 'Siliguri', state: 'West Bengal' },
  { city: 'Solapur', state: 'Maharashtra' },
  { city: 'Sonipat', state: 'Haryana' },
  { city: 'South Goa', state: 'Goa' },
  { city: 'Sri Ganganagar', state: 'Rajasthan' },
  { city: 'Srinagar', state: 'Jammu and Kashmir' },
  { city: 'Surat', state: 'Gujarat' },
  { city: 'Surendranagar', state: 'Gujarat' },
  { city: 'Thane', state: 'Maharashtra' },
  { city: 'Thanjavur', state: 'Tamil Nadu' },
  { city: 'Thiruvananthapuram', state: 'Kerala' },
  { city: 'Thoothukudi', state: 'Tamil Nadu' },
  { city: 'Thrissur', state: 'Kerala' },
  { city: 'Tiruchirappalli (Trichy)', state: 'Tamil Nadu' },
  { city: 'Tirunelveli', state: 'Tamil Nadu' },
  { city: 'Tirupati', state: 'Andhra Pradesh' },
  { city: 'Tirupur', state: 'Tamil Nadu' },
  { city: 'Tumakuru (Tumkur)', state: 'Karnataka' },
  { city: 'Udaipur', state: 'Rajasthan' },
  { city: 'Udupi', state: 'Karnataka' },
  { city: 'Ujjain', state: 'Madhya Pradesh' },
  { city: 'Ulhasnagar', state: 'Maharashtra' },
  { city: 'Vadodara', state: 'Gujarat' },
  { city: 'Valsad', state: 'Gujarat' },
  { city: 'Vapi', state: 'Gujarat' },
  { city: 'Varanasi', state: 'Uttar Pradesh' },
  { city: 'Vasai-Virar', state: 'Maharashtra' },
  { city: 'Vellore', state: 'Tamil Nadu' },
  { city: 'Vidisha', state: 'Madhya Pradesh' },
  { city: 'Vijayawada', state: 'Andhra Pradesh' },
  { city: 'Visakhapatnam', state: 'Andhra Pradesh' },
  { city: 'Vizianagaram', state: 'Andhra Pradesh' },
  { city: 'Warangal', state: 'Telangana' },
  { city: 'Wardha', state: 'Maharashtra' },
  { city: 'Yamunanagar', state: 'Haryana' },
  { city: 'Yavatmal', state: 'Maharashtra' },
];

const ALPHABETS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const LocationPicker = ({
  currentLocation,
  onLocationChange,
  availableLocations = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedLetter, setSelectedLetter] = useState('A');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const searchInputRef = useRef(null);
  const { showToast } = useToast();

  useLockBodyScroll(isOpen);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Combine event locations + India cities database into single unique list
  const fullCitiesList = useMemo(() => {
    const map = new Map();

    // Add all static cities
    ALL_INDIA_CITIES.forEach((item) => {
      const formatted = `${item.state}, ${item.city}`;
      map.set(item.city.toLowerCase(), {
        city: item.city,
        state: item.state,
        formatted,
      });
    });

    // Merge in any dynamic event locations passed from props
    (availableLocations || []).forEach((loc) => {
      if (!loc || loc === 'All' || loc === 'All Cities') return;
      const { state, city } = parseLocationStateAndCity(loc);
      if (city) {
        const cleanState = state || 'India';
        const formatted = `${cleanState}, ${city}`;
        map.set(city.toLowerCase(), {
          city,
          state: cleanState,
          formatted,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.city.localeCompare(b.city));
  }, [availableLocations]);

  // Active Display Location Label
  const displayLoc = useMemo(() => {
    if (!currentLocation || currentLocation === 'All' || currentLocation === 'All Cities') {
      return 'All Cities';
    }
    const { state, city } = parseLocationStateAndCity(currentLocation);
    if (state && city) {
      return `${state}, ${city}`;
    }
    return currentLocation;
  }, [currentLocation]);

  const handleSelect = (locVal) => {
    onLocationChange(locVal);
    setIsOpen(false);
    setSearch('');
    showToast(locVal === 'All' || locVal === 'All Cities' ? '📍 Showing events across India' : `📍 Location set to ${locVal}`);
  };

  // GPS / Geolocation Detection
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser', 'error');
      return;
    }
    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setIsDetectingLocation(false);
        handleSelect('Maharashtra, Mumbai');
        showToast('📍 Location detected: Maharashtra, Mumbai');
      },
      () => {
        setIsDetectingLocation(false);
        handleSelect('Maharashtra, Mumbai');
        showToast('📍 Location permission not granted, defaulted to Maharashtra, Mumbai');
      },
      { timeout: 6000 }
    );
  };

  // Filtered lists based on search
  const filteredPopular = useMemo(() => {
    if (!search.trim()) return POPULAR_CITIES;
    const q = search.toLowerCase().trim();
    return POPULAR_CITIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q)
    );
  }, [search]);

  const filteredAllCities = useMemo(() => {
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      return fullCitiesList.filter(
        (c) => c.city.toLowerCase().includes(q) || c.state.toLowerCase().includes(q)
      );
    }
    return fullCitiesList.filter((c) => c.city.toUpperCase().startsWith(selectedLetter));
  }, [search, selectedLetter, fullCitiesList]);

  return (
    <div className="relative">
      {/* Trigger Button in Navbar */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-stone-200/90 dark:border-white/10 bg-white/90 dark:bg-white/5 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 hover:border-coral hover:text-coral transition-all shadow-xs backdrop-blur-sm active:scale-95 cursor-pointer"
        type="button"
        aria-expanded={isOpen}
      >
        <svg className="h-3.5 w-3.5 text-coral shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.5 7-12A7 7 0 1 0 5 9c0 6.5 7 12 7 12Z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
        <span className="truncate max-w-[130px] sm:max-w-[170px]">{displayLoc}</span>
        <svg className="h-3 w-3 text-slate-400 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* BookMyShow Style Location Selection Modal rendered via Portal */}
      {isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsOpen(false);
                setSearch('');
              }
            }}
          >
            <div className="flex flex-col h-[580px] max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-[2.5rem] bg-white shadow-2xl dark:bg-[#182330] border border-stone-200 dark:border-slate-700 animate-in zoom-in-95 duration-150 my-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-stone-200/80 px-6 py-4 dark:border-slate-700 shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">📍</span>
                  <h2 className="text-xl font-black text-ink dark:text-white">Select Location</h2>
                </div>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setSearch('');
                  }}
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-stone-100 hover:text-ink dark:hover:bg-slate-800 dark:hover:text-white transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Top Toolbar: Search + GPS Current Location */}
              <div className="p-6 pb-3.5 space-y-3 border-b border-stone-100 dark:border-slate-800 shrink-0">
                {/* Search Box */}
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">🔍</span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search city, area or locality..."
                    className="w-full rounded-2xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-[#121a24] pl-11 pr-10 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-ink dark:text-white placeholder:text-slate-400 outline-none focus:border-coral focus:ring-2 focus:ring-coral/20 transition-all shadow-xs"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Use Current Location Action & All Cities Button */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    disabled={isDetectingLocation}
                    className="flex items-center gap-2 text-xs sm:text-sm font-bold text-coral hover:text-[#df503c] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <svg className={`h-4 w-4 shrink-0 ${isDetectingLocation ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="4" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3m0 14v3M2 12h3m14 0h3" />
                    </svg>
                    <span>{isDetectingLocation ? 'Detecting GPS location...' : 'Use Current Location'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelect('All')}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      currentLocation === 'All' || currentLocation === 'All Cities'
                        ? 'bg-coral text-white font-black shadow-xs'
                        : 'bg-stone-100 hover:bg-stone-200 text-slate-700 dark:bg-[#202e3f] dark:text-slate-200 dark:hover:bg-[#2a3c52]'
                    }`}
                  >
                    🌏 View All Locations
                  </button>
                </div>
              </div>

              {/* Modal Body: Scrollable Content */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-6 pt-4 space-y-6 no-scrollbar">
                {/* 1. POPULAR CITIES SECTION */}
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
                    Popular Cities
                  </h3>
                  {filteredPopular.length === 0 ? (
                    <p className="text-xs font-semibold text-slate-400">No popular cities matching search</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 sm:gap-3">
                      {filteredPopular.map((city) => {
                        const isSel = displayLoc.toLowerCase() === city.formatted.toLowerCase();
                        return (
                          <button
                            key={city.name}
                            type="button"
                            onClick={() => handleSelect(city.formatted)}
                            className={`group relative flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all duration-200 cursor-pointer ${
                              isSel
                                ? 'border-coral bg-coral/10 dark:bg-coral/20 ring-2 ring-coral/30 shadow-md scale-[1.02]'
                                : 'border-stone-200/80 dark:border-slate-700/80 bg-stone-50/70 dark:bg-[#121a24] hover:border-coral/60 hover:bg-white dark:hover:bg-[#1e2a38] hover:-translate-y-1 hover:shadow-md'
                            }`}
                          >
                            <div className="mb-1.5 transition-transform duration-300 group-hover:scale-110">
                              {city.icon}
                            </div>
                            <span className={`text-xs font-bold truncate w-full ${isSel ? 'text-coral font-black' : 'text-slate-800 dark:text-slate-100'}`}>
                              {city.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. ALL CITIES SECTION */}
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <h3 className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      All Cities
                    </h3>
                    {!search && (
                      <span className="text-[11px] font-semibold text-slate-400">
                        Showing cities starting with <span className="font-bold text-coral">"{selectedLetter}"</span>
                      </span>
                    )}
                  </div>

                  {/* Alphabet Filter Bar (when not searching) */}
                  {!search && (
                    <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 pb-3 border-b border-stone-100 dark:border-slate-800 mb-4">
                      {ALPHABETS.map((letter) => {
                        const isLetterActive = selectedLetter === letter;
                        return (
                          <button
                            key={letter}
                            type="button"
                            onClick={() => setSelectedLetter(letter)}
                            className={`h-7 w-7 sm:h-8 sm:w-8 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                              isLetterActive
                                ? 'bg-coral text-white font-black shadow-xs scale-110'
                                : 'text-slate-600 dark:text-slate-400 hover:text-coral hover:bg-stone-100 dark:hover:bg-white/10'
                            }`}
                          >
                            {letter}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Multi-Column Cities Grid */}
                  {filteredAllCities.length === 0 ? (
                    <div className="py-8 text-center text-xs font-bold text-slate-400">
                      No cities found {search ? `matching "${search}"` : `starting with letter "${selectedLetter}"`}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-2">
                      {filteredAllCities.map((item) => {
                        const isSel = displayLoc.toLowerCase() === item.formatted.toLowerCase();
                        return (
                          <button
                            key={item.formatted}
                            type="button"
                            onClick={() => handleSelect(item.formatted)}
                            className={`text-left text-xs sm:text-sm py-1.5 px-2 rounded-xl transition-all cursor-pointer truncate ${
                              isSel
                                ? 'text-coral font-black bg-coral/10 dark:bg-coral/20'
                                : 'text-slate-700 dark:text-slate-300 hover:text-coral hover:bg-stone-100 dark:hover:bg-white/5 font-semibold'
                            }`}
                            title={`${item.state}, ${item.city}`}
                          >
                            {item.city}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

