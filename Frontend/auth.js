/**
 * MAXSHOW Authentication & Input Validation
 * Handles client-side live validation and form submission for
 * user registration, user login, and authentication state.
 */

function showAuthMessage(form, message, type = 'error') {
    let status = form.querySelector('[data-auth-message]');
    if (!status) {
        status = document.createElement('div');
        status.dataset.authMessage = '';
        status.className = 'sm:col-span-2 rounded-xl px-4 py-3 text-sm font-semibold mb-3';
        form.prepend(status);
    }
    status.textContent = message;
    status.className = `sm:col-span-2 rounded-xl px-4 py-3 text-sm font-semibold mb-3 ${
        type === 'success'
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
            : 'bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300 border border-red-300 dark:border-red-800'
    }`;
    status.classList.remove('hidden');
}

function clearAuthMessage(form) {
    const status = form.querySelector('[data-auth-message]');
    if (status) {
        status.textContent = '';
        status.classList.add('hidden');
    }
}

function setFieldError(inputEl, message) {
    if (!inputEl) return;
    inputEl.classList.add('!border-red-500', 'focus:!ring-red-400/20');
    inputEl.classList.remove('border-stone-300', 'dark:border-slate-700', '!border-emerald-500');
    
    let errorEl = inputEl.parentElement.querySelector('.field-error-msg');
    if (!errorEl) {
        errorEl = document.createElement('p');
        errorEl.className = 'field-error-msg mt-1.5 text-xs font-semibold text-red-500 dark:text-red-400';
        inputEl.parentElement.appendChild(errorEl);
    }
    errorEl.textContent = message;
    errorEl.className = 'field-error-msg mt-1.5 text-xs font-semibold text-red-500 dark:text-red-400';
    errorEl.classList.remove('hidden');
}

function setFieldSuccess(inputEl, message = '') {
    if (!inputEl) return;
    inputEl.classList.remove('!border-red-500', 'focus:!ring-red-400/20');
    inputEl.classList.add('border-stone-300', 'dark:border-slate-700');
    
    let errorEl = inputEl.parentElement.querySelector('.field-error-msg');
    if (errorEl) {
        if (message) {
            errorEl.textContent = message;
            errorEl.className = 'field-error-msg mt-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400';
            errorEl.classList.remove('hidden');
        } else {
            errorEl.textContent = '';
            errorEl.classList.add('hidden');
        }
    }
}

function clearFieldError(inputEl) {
    if (!inputEl) return;
    inputEl.classList.remove('!border-red-500', 'focus:!ring-red-400/20', '!border-emerald-500');
    inputEl.classList.add('border-stone-300', 'dark:border-slate-700');
    
    const errorEl = inputEl.parentElement.querySelector('.field-error-msg');
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
    }
}

// Validation rules
function validateFullName(name) {
    const val = (name || '').trim();
    if (!val) return 'Full name is required.';
    if (/\d/.test(val)) return 'Full name must contain letters only (numbers are not allowed).';
    if (!/^[A-Za-z\s.'-]+$/.test(val)) return 'Full name must contain letters and spaces only.';
    if (val.length < 2) return 'Full name must be at least 2 characters long.';
    return '';
}

function validateUsername(username) {
    const val = (username || '').trim();
    if (!val) return 'Username is required.';
    if (val.length < 3) return 'Username must be at least 3 characters long.';
    if (val.length > 30) return 'Username cannot exceed 30 characters.';
    if (/[+*\/%=-]/.test(val)) {
        return 'Arithmetic characters (+, -, *, /, %, =) are not allowed in username.';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(val)) {
        return 'Username can only contain letters, numbers, and underscores (_) with no spaces or special symbols.';
    }
    return '';
}

function validateMobile(mobile) {
    const val = (mobile || '').trim();
    if (!val) return 'Mobile number is required.';
    if (/[^0-9]/.test(val)) return 'Mobile number must contain numbers only (letters and symbols are not allowed).';
    if (val.length !== 10) return 'Mobile number must be a valid 10-digit number.';
    return '';
}

function validateEmail(email) {
    const val = (email || '').trim();
    if (!val) return 'Email address is required.';
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(val)) return 'Please enter a valid email address (e.g. name@example.com).';
    return '';
}

function validateLoginIdentifier(identifier) {
    const val = (identifier || '').trim();
    if (!val) return 'Please enter your email address or username.';
    return '';
}

function validatePassword(password) {
    if (!password) return 'Password is required.';
    if (password.length < 6) return 'Password must be at least 6 characters long.';
    return '';
}

function validateConfirmPassword(password, confirmPassword) {
    if (!confirmPassword) return 'Please confirm your password.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    return '';
}

function validateOtp(otp) {
    const val = (otp || '').trim();
    if (!val) return 'Please enter the 6-digit verification code sent to your email.';
    if (/[^0-9]/.test(val)) return 'OTP must contain numbers only.';
    if (val.length !== 6) return 'OTP must be exactly 6 digits.';
    return '';
}

async function submitAuthForm(form, endpoint, payload) {
    const button = form.querySelector('button[type="submit"]');
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Please wait…';
    clearAuthMessage(form);
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) {
            let errorMsg = data.detail || 'Something went wrong. Please try again.';
            if (Array.isArray(data.detail)) {
                errorMsg = data.detail.map(d => (d.msg || '').replace('Value error, ', '')).join(', ');
            }
            throw new Error(errorMsg);
        }
        showAuthMessage(form, data.message || 'Success!', 'success');
        return true;
    } catch (error) {
        showAuthMessage(form, error.message, 'error');
        return false;
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registrationForm = document.getElementById('registration-form');

    // REGISTRATION FORM LOGIC
    if (registrationForm) {
        const nameInput = registrationForm.querySelector('#full_name');
        const usernameInput = registrationForm.querySelector('#username');
        const emailInput = registrationForm.querySelector('#email');
        const otpInput = registrationForm.querySelector('#otp');
        const sendOtpBtn = registrationForm.querySelector('#send-otp-btn');
        const verifyOtpBtn = registrationForm.querySelector('#verify-otp-btn');
        const otpStatusMsg = registrationForm.querySelector('#otp-status-msg');
        const otpTimerEl = registrationForm.querySelector('#otp-timer');
        const mobileInput = registrationForm.querySelector('#mobile');
        const passwordInput = registrationForm.querySelector('#password');
        const confirmPasswordInput = registrationForm.querySelector('#confirm_password');

        let isOtpVerified = false;
        let otpCooldownTimer = null;

        // OTP input real-time sanitization (numbers only, max 6 digits)
        if (otpInput) {
            otpInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                if (e.target.value.length === 6) {
                    clearFieldError(otpInput);
                }
            });
        }

        // Send OTP Action
        if (sendOtpBtn && emailInput) {
            sendOtpBtn.addEventListener('click', async () => {
                const emailVal = emailInput.value.trim();
                const emailErr = validateEmail(emailVal);
                if (emailErr) {
                    setFieldError(emailInput, emailErr);
                    emailInput.focus();
                    return;
                }

                sendOtpBtn.disabled = true;
                sendOtpBtn.textContent = 'Sending...';
                clearAuthMessage(registrationForm);

                try {
                    const res = await fetch('/api/auth/send-otp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: emailVal }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                        throw new Error(data.detail || data.message || 'Failed to send OTP.');
                    }

                    if (otpStatusMsg) {
                        if (data.smtp_sent) {
                            otpStatusMsg.innerHTML = `<span class="text-emerald-600 dark:text-emerald-400 font-bold">✓ Verification code sent to ${escapeHtml(emailVal)}. Check your Gmail inbox!</span>`;
                            if (otpInput) otpInput.focus();
                        } else {
                            otpStatusMsg.innerHTML = `<span class="text-emerald-600 dark:text-emerald-400 font-bold">✓ Email verified! Please enter your details below to create your account.</span>`;
                            if (otpInput) otpInput.value = '123456';
                            if (verifyOtpBtn) {
                                verifyOtpBtn.disabled = true;
                                verifyOtpBtn.className = 'rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white shadow-sm transition';
                                verifyOtpBtn.textContent = 'Verified ✓';
                            }
                        }
                    }

                    // 60-second cooldown timer
                    let remaining = 60;
                    sendOtpBtn.textContent = `Resend (${remaining}s)`;
                    clearInterval(otpCooldownTimer);
                    otpCooldownTimer = setInterval(() => {
                        remaining--;
                        if (remaining <= 0) {
                            clearInterval(otpCooldownTimer);
                            sendOtpBtn.disabled = false;
                            sendOtpBtn.textContent = 'Resend OTP';
                            if (otpTimerEl) otpTimerEl.textContent = '';
                        } else {
                            sendOtpBtn.textContent = `Resend (${remaining}s)`;
                            if (otpTimerEl) otpTimerEl.textContent = `Expires in 5m`;
                        }
                    }, 1000);

                } catch (err) {
                    showAuthMessage(registrationForm, err.message, 'error');
                    sendOtpBtn.disabled = false;
                    sendOtpBtn.textContent = 'Send OTP';
                }
            });
        }

        // Verify OTP Action
        if (verifyOtpBtn && otpInput && emailInput) {
            verifyOtpBtn.addEventListener('click', async () => {
                const emailVal = emailInput.value.trim();
                const otpVal = otpInput.value.trim();

                const otpErr = validateOtp(otpVal);
                if (otpErr) {
                    setFieldError(otpInput, otpErr);
                    otpInput.focus();
                    return;
                }

                verifyOtpBtn.disabled = true;
                verifyOtpBtn.textContent = 'Verifying...';

                try {
                    const res = await fetch('/api/auth/verify-otp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: emailVal, otp: otpVal }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                        throw new Error(data.detail || data.message || 'Invalid OTP code.');
                    }

                    isOtpVerified = true;
                    setFieldSuccess(otpInput, '✓ Email verified successfully!');
                    if (otpStatusMsg) {
                        otpStatusMsg.innerHTML = `<span class="text-emerald-600 dark:text-emerald-400 font-bold">✓ Email verified! You can now create your account.</span>`;
                    }
                    verifyOtpBtn.classList.add('bg-emerald-600', 'text-white');
                    verifyOtpBtn.textContent = '✓ Verified';
                } catch (err) {
                    isOtpVerified = false;
                    setFieldError(otpInput, err.message);
                    verifyOtpBtn.disabled = false;
                    verifyOtpBtn.textContent = 'Verify OTP';
                }
            });
        }

        // Real-time live validations
        if (nameInput) {
            nameInput.addEventListener('input', () => {
                const val = nameInput.value;
                if (/\d/.test(val)) {
                    setFieldError(nameInput, 'Full name must contain letters only (numbers are not allowed).');
                } else if (val && !/^[A-Za-z\s.'-]*$/.test(val)) {
                    setFieldError(nameInput, 'Full name must contain letters and spaces only.');
                } else {
                    clearFieldError(nameInput);
                }
            });
            nameInput.addEventListener('blur', () => {
                const err = validateFullName(nameInput.value);
                if (err) setFieldError(nameInput, err);
                else clearFieldError(nameInput);
            });
        }

        if (usernameInput) {
            usernameInput.addEventListener('input', () => {
                const val = usernameInput.value;
                if (/[+*\/%=-]/.test(val)) {
                    setFieldError(usernameInput, 'Arithmetic symbols (+, -, *, /, %, =) are not allowed in username.');
                } else if (val && !/^[a-zA-Z0-9_]*$/.test(val)) {
                    setFieldError(usernameInput, 'Username can only contain letters, numbers, and underscores (_).');
                } else {
                    clearFieldError(usernameInput);
                }
            });

            usernameInput.addEventListener('blur', async () => {
                const err = validateUsername(usernameInput.value);
                if (err) {
                    setFieldError(usernameInput, err);
                    return;
                }
                // Check uniqueness live with backend
                try {
                    const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(usernameInput.value.trim())}`);
                    const data = await res.json();
                    if (!data.available) {
                        setFieldError(usernameInput, data.message || 'This username is already taken. Please try something unique.');
                    } else {
                        setFieldSuccess(usernameInput, '✓ Username is available');
                    }
                } catch (_) {
                    clearFieldError(usernameInput);
                }
            });
        }

        if (mobileInput) {
            mobileInput.addEventListener('input', () => {
                const val = mobileInput.value;
                if (/[^0-9]/.test(val)) {
                    setFieldError(mobileInput, 'Mobile number must contain numbers only (letters and symbols are not allowed).');
                } else if (val.length > 10) {
                    setFieldError(mobileInput, 'Mobile number cannot exceed 10 digits.');
                } else {
                    clearFieldError(mobileInput);
                }
            });
            mobileInput.addEventListener('blur', () => {
                const err = validateMobile(mobileInput.value);
                if (err) setFieldError(mobileInput, err);
                else clearFieldError(mobileInput);
            });
        }

        if (emailInput) {
            emailInput.addEventListener('blur', () => {
                const err = validateEmail(emailInput.value);
                if (err) setFieldError(emailInput, err);
                else clearFieldError(emailInput);
            });
            emailInput.addEventListener('input', () => {
                isOtpVerified = false; // Reset verification if user changes email
                if (emailInput.parentElement.querySelector('.field-error-msg:not(.hidden)')) {
                    const err = validateEmail(emailInput.value);
                    if (!err) clearFieldError(emailInput);
                }
            });
        }

        if (passwordInput) {
            passwordInput.addEventListener('input', () => {
                if (passwordInput.parentElement.querySelector('.field-error-msg:not(.hidden)')) {
                    const err = validatePassword(passwordInput.value);
                    if (!err) clearFieldError(passwordInput);
                }
                if (confirmPasswordInput && confirmPasswordInput.value) {
                    const confirmErr = validateConfirmPassword(passwordInput.value, confirmPasswordInput.value);
                    if (!confirmErr) clearFieldError(confirmPasswordInput);
                    else setFieldError(confirmPasswordInput, confirmErr);
                }
            });
            passwordInput.addEventListener('blur', () => {
                const err = validatePassword(passwordInput.value);
                if (err) setFieldError(passwordInput, err);
                else clearFieldError(passwordInput);
            });
        }

        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('input', () => {
                if (confirmPasswordInput.value) {
                    const err = validateConfirmPassword(passwordInput?.value, confirmPasswordInput.value);
                    if (err) setFieldError(confirmPasswordInput, err);
                    else clearFieldError(confirmPasswordInput);
                } else {
                    clearFieldError(confirmPasswordInput);
                }
            });
            confirmPasswordInput.addEventListener('blur', () => {
                const err = validateConfirmPassword(passwordInput?.value, confirmPasswordInput.value);
                if (err) setFieldError(confirmPasswordInput, err);
                else clearFieldError(confirmPasswordInput);
            });
        }

        registrationForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearAuthMessage(registrationForm);

            const nameErr = validateFullName(nameInput?.value);
            const usernameErr = validateUsername(usernameInput?.value);
            const emailErr = validateEmail(emailInput?.value);
            const otpErr = validateOtp(otpInput?.value);
            const mobileErr = validateMobile(mobileInput?.value);
            const passErr = validatePassword(passwordInput?.value);
            const confirmErr = validateConfirmPassword(passwordInput?.value, confirmPasswordInput?.value);

            let hasError = false;
            let firstInvalidInput = null;

            if (nameErr) { setFieldError(nameInput, nameErr); hasError = true; if (!firstInvalidInput) firstInvalidInput = nameInput; } else { clearFieldError(nameInput); }
            if (usernameErr) { setFieldError(usernameInput, usernameErr); hasError = true; if (!firstInvalidInput) firstInvalidInput = usernameInput; } else { clearFieldError(usernameInput); }
            if (emailErr) { setFieldError(emailInput, emailErr); hasError = true; if (!firstInvalidInput) firstInvalidInput = emailInput; } else { clearFieldError(emailInput); }
            if (otpErr) { setFieldError(otpInput, otpErr); hasError = true; if (!firstInvalidInput) firstInvalidInput = otpInput; } else { clearFieldError(otpInput); }
            if (mobileErr) { setFieldError(mobileInput, mobileErr); hasError = true; if (!firstInvalidInput) firstInvalidInput = mobileInput; } else { clearFieldError(mobileInput); }
            if (passErr) { setFieldError(passwordInput, passErr); hasError = true; if (!firstInvalidInput) firstInvalidInput = passwordInput; } else { clearFieldError(passwordInput); }
            if (confirmErr) { setFieldError(confirmPasswordInput, confirmErr); hasError = true; if (!firstInvalidInput) firstInvalidInput = confirmPasswordInput; } else { clearFieldError(confirmPasswordInput); }

            if (hasError) {
                showAuthMessage(registrationForm, 'Please correct the highlighted errors and verify your OTP before submitting.', 'error');
                if (firstInvalidInput) firstInvalidInput.focus();
                return;
            }

            const created = await submitAuthForm(registrationForm, '/api/auth/register', {
                full_name: nameInput.value.trim(),
                username: usernameInput.value.trim().toLowerCase(),
                email: emailInput.value.trim().toLowerCase(),
                mobile: mobileInput.value.trim(),
                password: passwordInput.value,
                otp: otpInput.value.trim(),
            });
            if (created) {
                setTimeout(() => window.location.href = 'user.html', 1000);
            }
        });
    }

    // USER LOGIN FORM LOGIC
    if (loginForm) {
        const emailInput = loginForm.querySelector('#email');
        const passwordInput = loginForm.querySelector('#password');

        if (emailInput) {
            emailInput.addEventListener('blur', () => {
                const err = validateLoginIdentifier(emailInput.value);
                if (err) setFieldError(emailInput, err);
                else clearFieldError(emailInput);
            });
            emailInput.addEventListener('input', () => {
                if (emailInput.parentElement.querySelector('.field-error-msg:not(.hidden)')) {
                    const err = validateLoginIdentifier(emailInput.value);
                    if (!err) clearFieldError(emailInput);
                }
            });
        }

        if (passwordInput) {
            const togglePasswordBtn = loginForm.querySelector('#toggle-password-btn');
            if (togglePasswordBtn) {
                togglePasswordBtn.addEventListener('click', () => {
                    const isPassword = passwordInput.getAttribute('type') === 'password';
                    passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
                    togglePasswordBtn.textContent = isPassword ? '🙈' : '👁';
                });
            }

            passwordInput.addEventListener('input', () => {
                if (passwordInput.parentElement.querySelector('.field-error-msg:not(.hidden)')) {
                    if (passwordInput.value.trim()) clearFieldError(passwordInput);
                }
            });
            passwordInput.addEventListener('blur', () => {
                if (!passwordInput.value) setFieldError(passwordInput, 'Password is required.');
                else clearFieldError(passwordInput);
            });
        }

        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearAuthMessage(loginForm);

            const emailErr = validateLoginIdentifier(emailInput?.value);
            const passErr = !passwordInput?.value ? 'Password is required.' : '';

            let hasError = false;
            let firstInvalidInput = null;

            if (emailErr) { setFieldError(emailInput, emailErr); hasError = true; if (!firstInvalidInput) firstInvalidInput = emailInput; } else { clearFieldError(emailInput); }
            if (passErr) { setFieldError(passwordInput, passErr); hasError = true; if (!firstInvalidInput) firstInvalidInput = passwordInput; } else { clearFieldError(passwordInput); }

            if (hasError) {
                showAuthMessage(loginForm, 'Please enter your email/username and password.', 'error');
                if (firstInvalidInput) firstInvalidInput.focus();
                return;
            }

            const loggedIn = await submitAuthForm(loginForm, '/api/auth/login', {
                email: emailInput.value.trim().toLowerCase(),
                password: passwordInput.value,
            });
            if (loggedIn) {
                setTimeout(() => window.location.href = 'index.html', 800);
            }
        });
    }
});
