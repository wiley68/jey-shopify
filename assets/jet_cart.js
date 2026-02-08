/**
 * Jet Cart – бутон за изплащане на страница количка (обща цена, без „Добави в количката“)
 */
(function () {
  // Първоначална вноска (в центове, по подразбиране 0)
  let jet_parva = 0;

  /** Курс 1 EUR = 1.95583 BGN (за показ на суми в лева в попъпа) */
  var JET_EUR_TO_BGN = 1.95583;

  var JETCREDIT_FINANCIAL_MAX_ITERATIONS = 128;
  var JETCREDIT_FINANCIAL_PRECISION = 1e-8;

  /**
   * Изчислява лихвения процент (RATE) – метод на секанса
   * @param {number} nper - Брой периоди (вноски)
   * @param {number} pmt - Вноска за период
   * @param {number} pv - Настояща стойност (заемът, отрицателна стойност)
   * @param {number} fv - Бъдеща стойност (по подразбиране 0)
   * @param {number} type - 0 = вноска в края на периода, 1 = в началото (по подразбиране 0)
   * @param {number} guess - Начално предположение за лихвата (по подразбиране 0.1)
   * @returns {number} Лихва за период (десетична, напр. 0.01 за 1%)
   */
  function RATE(nper, pmt, pv, fv, type, guess) {
    if (fv === undefined) fv = 0;
    if (type === undefined) type = 0;
    if (guess === undefined) guess = 0.1;
    var rate = guess;
    var f;
    var y;
    if (Math.abs(rate) < JETCREDIT_FINANCIAL_PRECISION) {
      y = pv * (1 + nper * rate) + pmt * (1 + rate * type) * nper + fv;
    } else {
      f = Math.exp(nper * Math.log(1 + rate));
      y = pv * f + pmt * (1 / rate + type) * (f - 1) + fv;
    }
    var y0 = pv + pmt * nper + fv;
    var y1 = y;
    var i = 0;
    var x0 = 0;
    var x1 = rate;
    while ((Math.abs(y0 - y1) > JETCREDIT_FINANCIAL_PRECISION) && (i < JETCREDIT_FINANCIAL_MAX_ITERATIONS)) {
      rate = (y1 * x0 - y0 * x1) / (y1 - y0);
      x0 = x1;
      x1 = rate;
      if (Math.abs(rate) < JETCREDIT_FINANCIAL_PRECISION) {
        y = pv * (1 + nper * rate) + pmt * (1 + rate * type) * nper + fv;
      } else {
        f = Math.exp(nper * Math.log(1 + rate));
        y = pv * f + pmt * (1 / rate + type) * (f - 1) + fv;
      }
      y0 = y1;
      y1 = y;
      i++;
    }
    return rate;
  }

  /**
   * Изчислява ГПР (%) и ГЛП (%) от брой вноски, месечна вноска и общ размер на кредита (в евро)
   * @param {number} vnoski - Брой вноски
   * @param {number} monthlyVnoskaEuro - Месечна вноска в евро
   * @param {number} totalCreditPriceEuro - Общ размер на кредита в евро
   * @returns {{ gpr: number, glp: number }} gpr и glp в проценти
   */
  function calculateGprGlp(vnoski, monthlyVnoskaEuro, totalCreditPriceEuro) {
    var rate = RATE(vnoski, monthlyVnoskaEuro, -totalCreditPriceEuro, 0, 0, 0.1);
    var jetGprm = rate * 12;
    var jetGpr = (Math.pow(1 + jetGprm / 12, 12) - 1) * 100;
    var jetGlp = (rate * 12) * 100;
    return { gpr: jetGpr, glp: jetGlp };
  }

  /**
   * Изчислява броя вноски според цената
   * @param {number} productPrice - Цената в центове
   * @param {number} jetMinVnoski - Минимална цена за използване на default вноски (по подразбиране 125)
   * @param {number} jetVnoskiDefault - Брой вноски по подразбиране
   * @param {number} parva - Първоначална вноска в центове (по подразбиране 0)
   * @returns {number} Брой вноски
   */
  function calculateVnoski(productPrice, jetMinVnoski, jetVnoskiDefault, parva) {
    // Изчисляваме реалната сума за лизинговите вноски: jet_total_credit_price = jet_priceall - jet_parva
    const jet_total_credit_price = productPrice - (parva || 0);

    // Конвертираме цената от центове в евро
    const priceInEuro = jet_total_credit_price / 100.0;
    const minVnoski = jetMinVnoski || 125;
    const defaultVnoski = jetVnoskiDefault || 12;

    if (priceInEuro < minVnoski) {
      return 9;
    } else {
      return defaultVnoski;
    }
  }

  /**
   * Изчислява месечната вноска
   * @param {number} jetTotalCreditPrice - Общата сума за кредит в центове
   * @param {number} jetVnoski - Брой вноски
   * @param {number} jetPurcent - Процент
   * @returns {number} Месечна вноска в центове
   */
  function calculateJetVnoska(jetTotalCreditPrice, jetVnoski, jetPurcent) {
    // Конвертираме от центове в евро за изчисленията
    const totalCreditPriceEuro = jetTotalCreditPrice / 100.0;

    // Формула: jet_vnoska = (jet_total_credit_price / jet_vnoski) * (1 + (jet_vnoski * jet_purcent) / 100)
    const jetVnoskaEuro = (totalCreditPriceEuro / jetVnoski) * (1 + (jetVnoski * jetPurcent) / 100);

    // Конвертираме обратно в центове и закръгляме до 2 десетични знака
    return Math.round(jetVnoskaEuro * 100);
  }

  /**
   * Форматира сума в центове като евро с 2 десетични знака
   * @param {number} cents - Сума в центове
   * @returns {string} Форматирана сума (напр. "125.50")
   */
  function formatEuro(cents) {
    return (cents / 100.0).toFixed(2);
  }

  /**
   * Обновява текста за вноските на страницата (надписите под бутона)
   * @param {number} productPrice - Цената в центове
   * @param {number} parva - Първоначална вноска в центове (опционално, използва текущата стойност ако не е зададена)
   * @param {number} [vnoski] - Брой вноски (опционално; ако липсва, се изчислява от цената)
   */
  function updateVnoskaText(productPrice, parva, vnoski) {
    const container = document.getElementById('jet-cart-button-container');
    if (!container) return;

    const jetMinVnoski = parseFloat(container.dataset.jetMinVnoski || '125') || 125;
    const jetVnoskiDefault = parseFloat(container.dataset.jetVnoskiDefault || '12') || 12;
    const currentParva = parva !== undefined ? parva : jet_parva;

    // Изчисляваме реалната сума за кредит
    const jetTotalCreditPrice = productPrice - currentParva;

    // Брой вноски: от параметъра (напр. от попъпа) или изчислен от цената
    const vnoskiResolved =
      vnoski === undefined || vnoski === null
        ? calculateVnoski(productPrice, jetMinVnoski, jetVnoskiDefault, currentParva)
        : vnoski;

    // Обновяваме елементите за редовен лизинг (използва jet_purcent)
    const regularElements = document.querySelectorAll('.jet-vnoska-regular');
    regularElements.forEach(function (element) {
      if (element instanceof HTMLElement) {
        const jetPurcent = parseFloat(element.dataset.jetPurcent || '0') || 0;
        const jetVnoskaCents = calculateJetVnoska(jetTotalCreditPrice, vnoskiResolved, jetPurcent);
        const jetVnoskaFormatted = formatEuro(jetVnoskaCents);
        element.textContent = vnoskiResolved + ' x ' + jetVnoskaFormatted + ' €';
        element.dataset.vnoski = String(vnoskiResolved);
        element.dataset.jetVnoska = String(jetVnoskaCents);
      }
    });

    // Обновяваме елементите за кредитна карта (използва jet_purcent_card)
    const cardElements = document.querySelectorAll('.jet-vnoska-card');
    cardElements.forEach(function (element) {
      if (element instanceof HTMLElement) {
        const jetPurcentCard = parseFloat(element.dataset.jetPurcentCard || '0') || 0;
        const jetVnoskaCents = calculateJetVnoska(jetTotalCreditPrice, vnoskiResolved, jetPurcentCard);
        const jetVnoskaFormatted = formatEuro(jetVnoskaCents);
        element.textContent = vnoskiResolved + ' x ' + jetVnoskaFormatted + ' €';
        element.dataset.vnoski = String(vnoskiResolved);
        element.dataset.jetVnoska = String(jetVnoskaCents);
      }
    });
  }

  /**
   * Задава първоначалната вноска и обновява изчисленията
   * @param {number} parva - Първоначална вноска в центове
   */
  function setJetParva(parva) {
    jet_parva = parva || 0;
    const container = document.getElementById('jet-cart-button-container');
    if (container) {
      const productPrice = parseFloat(container.dataset.productPrice || '0');
      if (productPrice) {
        updateVnoskaText(productPrice, jet_parva);
      }
    }
  }

  /**
   * Отваря popup прозореца за лизинг (количка – цена от общата сума в количката)
   */
  function openJetPopup() {
    const overlay = document.getElementById('jet-popup-overlay-cart');
    if (!overlay) return;

    const container = document.getElementById('jet-cart-button-container');
    if (!container) return;

    // На страница количка ползваме само общата цена от data атрибута (в центове)
    const productPrice = parseFloat(container.dataset.productPrice || '0');

    const jetPurcent = parseFloat(container.dataset.jetPurcent || '0');
    const currentParva = jet_parva || 0;
    // Брой вноски при отваряне: от текста под бутона (ако е обновен) или от Liquid (data-jet-vnoski)
    const vnoskaEl = document.querySelector('.jet-vnoska-regular');
    const vnoskiFromEl = vnoskaEl instanceof HTMLElement ? vnoskaEl.dataset.vnoski : undefined;
    const currentVnoski = parseInt(
      vnoskiFromEl || container.dataset.jetVnoski || container.dataset.jetVnoskiDefault || '12',
      10
    );

    // При отваряне винаги показваме стъпка 1
    const step1 = document.getElementById('jet-popup-step1-cart');
    const step2 = document.getElementById('jet-popup-step2-cart');
    const footerStep1 = document.getElementById('jet-popup-footer-step1-cart');
    const footerStep2 = document.getElementById('jet-popup-footer-step2-cart');
    if (step1) step1.style.display = '';
    if (step2) step2.style.display = 'none';
    if (footerStep1) footerStep1.style.display = '';
    if (footerStep2) footerStep2.style.display = 'none';

    overlay.style.display = 'flex';

    const vnoskiListEl = document.getElementById('jet-vnoski-list-cart');
    if (vnoskiListEl) vnoskiListEl.hidden = true;

    // Обновяваме стойностите в popup-а след показване, за да се визуализира select-ът правилно
    updatePopupValues(productPrice, currentParva, currentVnoski, jetPurcent);
  }

  /**
   * Затваря popup прозореца и връща към стъпка 1
   */
  function closeJetPopup() {
    const overlay = document.getElementById('jet-popup-overlay-cart');
    if (overlay) {
      overlay.style.display = 'none';
    }
    /* Изчистване на полетата и чекбокса на стъпка 2 */
    var step2Ids = ['jet-step2-firstname-cart', 'jet-step2-lastname-cart', 'jet-step2-egn-cart', 'jet-step2-phone-cart', 'jet-step2-email-cart'];
    step2Ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el instanceof HTMLInputElement) {
        el.value = '';
        el.classList.remove('jet-input-error');
      }
    });
    var termsCheck = document.getElementById('jet-step2-terms-checkbox-cart');
    if (termsCheck && termsCheck instanceof HTMLInputElement) {
      termsCheck.checked = false;
    }
    var step2SubmitBtn = document.getElementById('jet-step2-submit-btn-cart');
    if (step2SubmitBtn && step2SubmitBtn instanceof HTMLButtonElement) {
      step2SubmitBtn.disabled = true;
    }
    const step1 = document.getElementById('jet-popup-step1-cart');
    const step2 = document.getElementById('jet-popup-step2-cart');
    const footerStep1 = document.getElementById('jet-popup-footer-step1-cart');
    const footerStep2 = document.getElementById('jet-popup-footer-step2-cart');
    if (step1) step1.style.display = '';
    if (step2) step2.style.display = 'none';
    if (footerStep1) footerStep1.style.display = '';
    if (footerStep2) footerStep2.style.display = 'none';
    var termsCheckbox = document.getElementById('jet-terms-checkbox-cart');
    var gdprCheckbox = document.getElementById('jet-gdpr-checkbox-cart');
    if (termsCheckbox && termsCheckbox instanceof HTMLInputElement) {
      termsCheckbox.checked = false;
      termsCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (gdprCheckbox && gdprCheckbox instanceof HTMLInputElement) {
      gdprCheckbox.checked = false;
      gdprCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    }
    jet_parva = 0;
    var parvaInput = document.getElementById('jet-parva-input-cart');
    if (parvaInput && parvaInput instanceof HTMLInputElement) {
      parvaInput.value = '0';
    }
    var container = document.getElementById('jet-cart-button-container');
    if (container) {
      var productPrice = parseFloat(container.dataset.productPrice || '0');
      if (productPrice) updateVnoskaText(productPrice, 0);
    }
  }

  /**
   * Обновява стойностите в popup прозореца
   * @param {number} productPrice - Цената в центове
   * @param {number} parva - Първоначална вноска в центове
   * @param {number} vnoski - Брой вноски
   * @param {number} jetPurcent - Процент
   */
  /** Формат за показ в input: евро и в лева вътре в полето (€ / лв.) @param {number} euro */
  function formatEuroBgn(euro) {
    var e = euro || 0;
    return e.toFixed(2) + ' / ' + (e * JET_EUR_TO_BGN).toFixed(2);
  }

  /** Задава евро + втора сума: в input (value) или в div с .jet-popup-euro и .jet-popup-bgn @param {string} elementId @param {number} euro */
  function setEuroBgnDisplay(elementId, euro) {
    var el = document.getElementById(elementId);
    if (!el) return;
    var e = euro || 0;
    var bgn = (e * JET_EUR_TO_BGN).toFixed(2);
    if (el instanceof HTMLInputElement) {
      el.value = e.toFixed(2) + ' / ' + bgn;
    } else {
      var euroSpan = el.querySelector('.jet-popup-euro');
      var bgnSpan = el.querySelector('.jet-popup-bgn');
      if (euroSpan) euroSpan.textContent = e.toFixed(2);
      if (bgnSpan) bgnSpan.textContent = ' / ' + bgn;
    }
  }

  /** Връща стойността в евро от полето (input или div с .jet-popup-euro) @param {string} elementId @returns {number} */
  function getEuroFromEuroBgnField(elementId) {
    var el = document.getElementById(elementId);
    if (!el) return 0;
    var euroSpan = el.querySelector('.jet-popup-euro');
    var raw = el instanceof HTMLInputElement ? el.value : (euroSpan ? euroSpan.textContent : '');
    return parseFloat(String(raw).replace(',', '.')) || 0;
  }

  /**
   * @param {number} productPrice
   * @param {number} parva
   * @param {number} vnoski
   * @param {number} jetPurcent
   */
  function updatePopupValues(productPrice, parva, vnoski, jetPurcent) {
    const container = document.getElementById('jet-cart-button-container');
    const jetMinpriceEuro = container ? (parseFloat(container.dataset.jetMinprice || '0') || 0) : 0;
    const maxParvaCents = Math.max(0, productPrice - Math.round(jetMinpriceEuro * 100));
    if (parva > maxParvaCents) parva = maxParvaCents;

    // Конвертираме от центове в евро
    const productPriceEuro = productPrice / 100.0;
    const parvaEuro = parva / 100.0;
    const totalCreditPriceEuro = productPriceEuro - parvaEuro;
    const totalCreditPriceCents = Math.round(totalCreditPriceEuro * 100);

    // Коригираме вноските според ограниченията за общия размер на кредита
    vnoski = getAllowedVnoski(totalCreditPriceEuro, vnoski);

    // Изчисляваме месечната вноска
    const monthlyVnoskaCents = calculateJetVnoska(totalCreditPriceCents, vnoski, jetPurcent);
    const monthlyVnoskaEuro = monthlyVnoskaCents / 100.0;

    // Изчисляваме общата стойност на плащанията
    const totalPaymentsEuro = vnoski * monthlyVnoskaEuro;

    // Обновяваме полетата
    const parvaInput = document.getElementById('jet-parva-input-cart');
    if (parvaInput && parvaInput instanceof HTMLInputElement) {
      parvaInput.value = String(Math.round(parvaEuro));
    }

    setEuroBgnDisplay('jet-product-price-input-cart', productPriceEuro);

    const vnoskiSelect = document.getElementById('jet-vnoski-select-cart');
    if (vnoskiSelect && vnoskiSelect instanceof HTMLSelectElement) {
      const val = String(vnoski);
      vnoskiSelect.value = val;
      for (let i = 0; i < vnoskiSelect.options.length; i++) {
        const opt = vnoskiSelect.options[i];
        if (opt && opt.value === val) {
          vnoskiSelect.selectedIndex = i;
          break;
        }
      }
      syncJetVnoskiDisplay();
    }

    setEuroBgnDisplay('jet-total-credit-input-cart', totalCreditPriceEuro);
    setEuroBgnDisplay('jet-monthly-vnoska-input-cart', monthlyVnoskaEuro);
    setEuroBgnDisplay('jet-total-payments-input-cart', totalPaymentsEuro);

    var gprGlp = calculateGprGlp(vnoski, monthlyVnoskaEuro, totalCreditPriceEuro);
    var gprInput = document.getElementById('jet-fix-gpr-input-cart');
    if (gprInput && gprInput instanceof HTMLInputElement) {
      gprInput.value = gprGlp.gpr.toFixed(2);
    }
    var glpInput = document.getElementById('jet-glp-input-cart');
    if (glpInput && glpInput instanceof HTMLInputElement) {
      glpInput.value = gprGlp.glp.toFixed(2);
    }

    applyVnoskiOptionsRestrictions(totalCreditPriceEuro);
  }

  /**
   * Преизчислява стойностите в popup-а
   */
  function recalculatePopup() {
    const container = document.getElementById('jet-cart-button-container');
    if (!container) return;

    const parvaInput = document.getElementById('jet-parva-input-cart');
    const vnoskiSelect = document.getElementById('jet-vnoski-select-cart');

    if (!parvaInput || !vnoskiSelect) return;

    const productPrice = parseFloat(container.dataset.productPrice || '0');
    const jetPurcent = parseFloat(container.dataset.jetPurcent || '0');
    const jetMinpriceEuro = parseFloat(container.dataset.jetMinprice || '0') || 0;
    const maxParvaCents = Math.max(0, productPrice - Math.round(jetMinpriceEuro * 100));

    // Вземаме стойностите от input полетата и ограничаваме първоначалната вноска
    let parvaEuro = parseFloat(parvaInput instanceof HTMLInputElement ? parvaInput.value : '0') || 0;
    let parvaCents = Math.round(parvaEuro * 100);
    if (parvaCents > maxParvaCents) {
      parvaCents = maxParvaCents;
      parvaEuro = parvaCents / 100;
      if (parvaInput instanceof HTMLInputElement) parvaInput.value = String(parvaCents / 100);
    }
    const vnoski = parseInt(vnoskiSelect instanceof HTMLSelectElement ? vnoskiSelect.value : '12') || 12;

    // Обновяваме глобалната променлива
    jet_parva = parvaCents;

    // Обновяваме стойностите в popup-а
    updatePopupValues(productPrice, parvaCents, vnoski, jetPurcent);

    // Обновяваме надписите под бутона с избрания брой вноски от попъпа
    updateVnoskaText(productPrice, parvaCents, vnoski);
  }

  /**
   * Връща стойностите на опции вноски, които трябва да са забранени според общия размер на кредита (в евро).
   * 1. totalCreditPriceEuro <= 200 -> забранени 15, 18, 24, 30, 36
   * 2. 200 < totalCreditPriceEuro <= 300 -> забранени 30, 36
   * 3. > 300 -> всички позволени
   * @param {number} totalCreditPriceEuro - Общ размер на кредита в евро
   * @returns {Set<string>} Множество от value стойности (стрингове), които трябва да са disabled
   */
  function getDisabledVnoskiValues(totalCreditPriceEuro) {
    const disabled = new Set();
    if (totalCreditPriceEuro <= 200) {
      ['15', '18', '24', '30', '36'].forEach(function (v) { disabled.add(v); });
    } else if (totalCreditPriceEuro <= 300) {
      disabled.add('30');
      disabled.add('36');
    }
    return disabled;
  }

  /**
   * Прилага ограниченията за опции вноски според общия размер на кредита и обновява native select + custom list
   * @param {number} totalCreditPriceEuro - Общ размер на кредита в евро
   */
  function applyVnoskiOptionsRestrictions(totalCreditPriceEuro) {
    const disabledSet = getDisabledVnoskiValues(totalCreditPriceEuro);
    const vnoskiSelect = document.getElementById('jet-vnoski-select-cart');
    if (vnoskiSelect && vnoskiSelect instanceof HTMLSelectElement) {
      for (let i = 0; i < vnoskiSelect.options.length; i++) {
        const opt = vnoskiSelect.options[i];
        if (opt) opt.disabled = disabledSet.has(opt.value);
      }
    }
    const vnoskiList = document.getElementById('jet-vnoski-list-cart');
    if (vnoskiList) {
      const options = vnoskiList.querySelectorAll('.jet-select-option');
      options.forEach(function (el) {
        const val = el.getAttribute('data-value');
        const isDisabled = val !== null && disabledSet.has(val);
        el.classList.toggle('jet-select-option--disabled', isDisabled);
        el.setAttribute('aria-disabled', isDisabled ? 'true' : 'false');
      });
    }
  }

  /**
   * Връща позволена стойност за вноски: ако текущата е забранена, връща първата позволена
   * @param {number} totalCreditPriceEuro - Общ размер на кредита в евро
   * @param {number} currentVnoski - Текущ избран брой вноски
   * @returns {number} Позволен брой вноски
   */
  function getAllowedVnoski(totalCreditPriceEuro, currentVnoski) {
    const disabledSet = getDisabledVnoskiValues(totalCreditPriceEuro);
    const allowed = [3, 6, 9, 12, 15, 18, 24, 30, 36].filter(function (v) { return !disabledSet.has(String(v)); });
    if (allowed.length === 0) return currentVnoski;
    if (disabledSet.has(String(currentVnoski))) return allowed[0] ?? currentVnoski;
    return currentVnoski;
  }

  /**
   * Синхронизира текста в custom dropdown за вноски с избраната опция в select
   */
  function syncJetVnoskiDisplay() {
    const sel = document.getElementById('jet-vnoski-select-cart');
    const display = document.getElementById('jet-vnoski-display-cart');
    if (!sel || !display || !(sel instanceof HTMLSelectElement)) return;
    const opt = sel.options[sel.selectedIndex];
    display.textContent = opt ? opt.textContent || opt.value : '';
  }

  /** Синхронизира custom dropdown за вноски – картов попъп (количка) */
  function syncJetVnoskiDisplayCard() {
    const sel = document.getElementById('jet-vnoski-select-card-cart');
    const display = document.getElementById('jet-vnoski-display-card-cart');
    if (!sel || !display || !(sel instanceof HTMLSelectElement)) return;
    const opt = sel.options[sel.selectedIndex];
    display.textContent = opt ? opt.textContent || opt.value : '';
  }

  /** Прилага ограничения за опции вноски – картов попъп (количка) @param {number} totalCreditPriceEuro */
  function applyVnoskiOptionsRestrictionsCard(totalCreditPriceEuro) {
    const disabledSet = getDisabledVnoskiValues(totalCreditPriceEuro);
    const vnoskiSelect = document.getElementById('jet-vnoski-select-card-cart');
    if (vnoskiSelect && vnoskiSelect instanceof HTMLSelectElement) {
      for (let i = 0; i < vnoskiSelect.options.length; i++) {
        const opt = vnoskiSelect.options[i];
        if (opt) opt.disabled = disabledSet.has(opt.value);
      }
    }
    const vnoskiList = document.getElementById('jet-vnoski-list-card-cart');
    if (vnoskiList) {
      const options = vnoskiList.querySelectorAll('.jet-select-option');
      options.forEach(function (el) {
        const val = el.getAttribute('data-value');
        const isDisabled = val !== null && disabledSet.has(val);
        el.classList.toggle('jet-select-option--disabled', isDisabled);
        el.setAttribute('aria-disabled', isDisabled ? 'true' : 'false');
      });
    }
  }

  /** Обновява стойностите в картовия popup (количка) – използва jet_purcent_card @param {number} productPrice @param {number} parva @param {number} vnoski @param {number} jetPurcentCard */
  function updatePopupValuesCard(productPrice, parva, vnoski, jetPurcentCard) {
    const container = document.getElementById('jet-cart-button-card-container');
    const jetMinpriceEuro = container ? (parseFloat(container.dataset.jetMinprice || '0') || 0) : 0;
    const maxParvaCents = Math.max(0, productPrice - Math.round(jetMinpriceEuro * 100));
    if (parva > maxParvaCents) parva = maxParvaCents;
    const productPriceEuro = productPrice / 100.0;
    const parvaEuro = parva / 100.0;
    const totalCreditPriceEuro = productPriceEuro - parvaEuro;
    const totalCreditPriceCents = Math.round(totalCreditPriceEuro * 100);
    vnoski = getAllowedVnoski(totalCreditPriceEuro, vnoski);
    const monthlyVnoskaCents = calculateJetVnoska(totalCreditPriceCents, vnoski, jetPurcentCard);
    const monthlyVnoskaEuro = monthlyVnoskaCents / 100.0;
    const totalPaymentsEuro = vnoski * monthlyVnoskaEuro;
    const parvaInput = document.getElementById('jet-parva-input-card-cart');
    if (parvaInput && parvaInput instanceof HTMLInputElement) parvaInput.value = String(Math.round(parvaEuro));
    setEuroBgnDisplay('jet-product-price-input-card-cart', productPriceEuro);
    const vnoskiSelect = document.getElementById('jet-vnoski-select-card-cart');
    if (vnoskiSelect && vnoskiSelect instanceof HTMLSelectElement) {
      const val = String(vnoski);
      vnoskiSelect.value = val;
      for (let i = 0; i < vnoskiSelect.options.length; i++) {
        const opt = vnoskiSelect.options[i];
        if (opt && opt.value === val) { vnoskiSelect.selectedIndex = i; break; }
      }
      syncJetVnoskiDisplayCard();
    }
    setEuroBgnDisplay('jet-total-credit-input-card-cart', totalCreditPriceEuro);
    setEuroBgnDisplay('jet-monthly-vnoska-input-card-cart', monthlyVnoskaEuro);
    setEuroBgnDisplay('jet-total-payments-input-card-cart', totalPaymentsEuro);
    var gprGlp = calculateGprGlp(vnoski, monthlyVnoskaEuro, totalCreditPriceEuro);
    var gprInput = document.getElementById('jet-fix-gpr-input-card-cart');
    if (gprInput && gprInput instanceof HTMLInputElement) gprInput.value = gprGlp.gpr.toFixed(2);
    var glpInput = document.getElementById('jet-glp-input-card-cart');
    if (glpInput && glpInput instanceof HTMLInputElement) glpInput.value = gprGlp.glp.toFixed(2);
    applyVnoskiOptionsRestrictionsCard(totalCreditPriceEuro);
  }

  function recalculatePopupCard() {
    const container = document.getElementById('jet-cart-button-card-container');
    if (!container) return;
    const parvaInput = document.getElementById('jet-parva-input-card-cart');
    const vnoskiSelect = document.getElementById('jet-vnoski-select-card-cart');
    if (!parvaInput || !vnoskiSelect) return;
    const productPrice = parseFloat(container.dataset.productPrice || '0');
    const jetPurcentCard = parseFloat(container.dataset.jetPurcentCard || '0');
    const jetMinpriceEuro = parseFloat(container.dataset.jetMinprice || '0') || 0;
    const maxParvaCents = Math.max(0, productPrice - Math.round(jetMinpriceEuro * 100));
    let parvaEuro = parseFloat(parvaInput instanceof HTMLInputElement ? parvaInput.value : '0') || 0;
    let parvaCents = Math.round(parvaEuro * 100);
    if (parvaCents > maxParvaCents) {
      parvaCents = maxParvaCents;
      parvaEuro = parvaCents / 100;
      if (parvaInput instanceof HTMLInputElement) parvaInput.value = String(parvaCents / 100);
    }
    const vnoski = parseInt(vnoskiSelect instanceof HTMLSelectElement ? vnoskiSelect.value : '12') || 12;
    updatePopupValuesCard(productPrice, parvaCents, vnoski, jetPurcentCard);
    updateVnoskaText(productPrice, parvaCents, vnoski);
  }

  function openJetPopupCard() {
    const overlay = document.getElementById('jet-popup-overlay-card-cart');
    if (!overlay) return;
    const container = document.getElementById('jet-cart-button-card-container');
    if (!container) return;
    const productPrice = parseFloat(container.dataset.productPrice || '0');
    const jetPurcentCard = parseFloat(container.dataset.jetPurcentCard || '0');
    const currentParva = parseFloat(container.dataset.jetParva || '0') || 0;
    const vnoskaEl = document.querySelector('.jet-vnoska-card');
    const vnoskiFromEl = vnoskaEl instanceof HTMLElement ? vnoskaEl.dataset.vnoski : undefined;
    const currentVnoski = parseInt(vnoskiFromEl || container.dataset.jetVnoskiDefault || '12', 10);
    const step1 = document.getElementById('jet-popup-step1-card-cart');
    const step2 = document.getElementById('jet-popup-step2-card-cart');
    const footerStep1 = document.getElementById('jet-popup-footer-step1-card-cart');
    const footerStep2 = document.getElementById('jet-popup-footer-step2-card-cart');
    if (step1) step1.style.display = '';
    if (step2) step2.style.display = 'none';
    if (footerStep1) footerStep1.style.display = '';
    if (footerStep2) footerStep2.style.display = 'none';
    const vnoskiListEl = document.getElementById('jet-vnoski-list-card-cart');
    if (vnoskiListEl) vnoskiListEl.hidden = true;
    overlay.style.display = 'flex';
    updatePopupValuesCard(productPrice, currentParva, currentVnoski, jetPurcentCard);
  }

  function closeJetPopupCard() {
    const overlay = document.getElementById('jet-popup-overlay-card-cart');
    if (overlay) overlay.style.display = 'none';
    var step2Ids = ['jet-step2-firstname-card-cart', 'jet-step2-lastname-card-cart', 'jet-step2-egn-card-cart', 'jet-step2-phone-card-cart', 'jet-step2-email-card-cart'];
    step2Ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el instanceof HTMLInputElement) {
        el.value = '';
        el.classList.remove('jet-input-error');
      }
    });
    var termsCheck = document.getElementById('jet-step2-terms-checkbox-card-cart');
    if (termsCheck && termsCheck instanceof HTMLInputElement) termsCheck.checked = false;
    var step2SubmitBtn = document.getElementById('jet-step2-submit-btn-card-cart');
    if (step2SubmitBtn && step2SubmitBtn instanceof HTMLButtonElement) step2SubmitBtn.disabled = true;
    const step1 = document.getElementById('jet-popup-step1-card-cart');
    const step2 = document.getElementById('jet-popup-step2-card-cart');
    const footerStep1 = document.getElementById('jet-popup-footer-step1-card-cart');
    const footerStep2 = document.getElementById('jet-popup-footer-step2-card-cart');
    if (step1) step1.style.display = '';
    if (step2) step2.style.display = 'none';
    if (footerStep1) footerStep1.style.display = '';
    if (footerStep2) footerStep2.style.display = 'none';
    var termsCheckboxCard = document.getElementById('jet-terms-checkbox-card-cart');
    var gdprCheckboxCard = document.getElementById('jet-gdpr-checkbox-card-cart');
    if (termsCheckboxCard && termsCheckboxCard instanceof HTMLInputElement) {
      termsCheckboxCard.checked = false;
      termsCheckboxCard.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (gdprCheckboxCard && gdprCheckboxCard instanceof HTMLInputElement) {
      gdprCheckboxCard.checked = false;
      gdprCheckboxCard.dispatchEvent(new Event('change', { bubbles: true }));
    }
    var parvaInputCard = document.getElementById('jet-parva-input-card-cart');
    if (parvaInputCard && parvaInputCard instanceof HTMLInputElement) {
      parvaInputCard.value = '0';
    }
  }

  /** Валидира българско ЕГН (10 цифри + контролна цифра) @param {string} egn */
  function isValidEgn(egn) {
    if (!egn || typeof egn !== 'string') return false;
    var digits = egn.replace(/\D/g, '');
    if (digits.length !== 10) return false;
    var weights = [2, 4, 8, 5, 10, 9, 7, 3, 6];
    var sum = 0;
    for (var i = 0; i < 9; i++) {
      var d = digits[i];
      var w = weights[i];
      if (d === undefined || w === undefined) return false;
      sum += parseInt(d, 10) * w;
    }
    var check = sum % 11;
    if (check === 10) check = 0;
    var last = digits[9];
    return last !== undefined && parseInt(last, 10) === check;
  }

  /**
   * Инициализира popup функционалността
   */
  function initPopup() {
    const overlay = document.getElementById('jet-popup-overlay-cart');
    if (!overlay) return;

    // Custom dropdown за брой вноски (количка)
    const vnoskiSelect = document.getElementById('jet-vnoski-select-cart');
    const vnoskiDisplay = document.getElementById('jet-vnoski-display-cart');
    const vnoskiList = document.getElementById('jet-vnoski-list-cart');
    if (vnoskiSelect && vnoskiDisplay && vnoskiList && vnoskiSelect instanceof HTMLSelectElement) {
      for (let i = 0; i < vnoskiSelect.options.length; i++) {
        const opt = vnoskiSelect.options[i];
        if (!opt) continue;
        const div = document.createElement('div');
        div.className = 'jet-select-option';
        div.setAttribute('role', 'option');
        div.dataset.value = opt.value;
        div.textContent = opt.textContent || opt.value;
        vnoskiList.appendChild(div);
      }
      syncJetVnoskiDisplay();
      vnoskiDisplay.addEventListener('click', function () {
        const hidden = vnoskiList.hidden;
        vnoskiList.hidden = !hidden;
      });
      vnoskiList.addEventListener('click', function (e) {
        const t = e.target;
        if (t && t instanceof HTMLElement && t.classList.contains('jet-select-option') && t.dataset.value !== undefined) {
          if (t.classList.contains('jet-select-option--disabled')) return;
          vnoskiSelect.value = t.dataset.value;
          vnoskiSelect.dispatchEvent(new Event('change', { bubbles: true }));
          syncJetVnoskiDisplay();
          vnoskiList.hidden = true;
        }
      });
      document.addEventListener('click', function closeList(e) {
        if (vnoskiList.hidden) return;
        const target = e.target instanceof Node ? e.target : null;
        if (target !== vnoskiDisplay && !vnoskiList.contains(target)) {
          vnoskiList.hidden = true;
        }
      });
    }

    const recalculateBtn = document.getElementById('jet-recalculate-btn-cart');
    if (recalculateBtn) recalculateBtn.addEventListener('click', recalculatePopup);

    const parvaInputForBlur = document.getElementById('jet-parva-input-cart');
    if (parvaInputForBlur) parvaInputForBlur.addEventListener('blur', recalculatePopup);

    const vnoskiSelectEl = document.getElementById('jet-vnoski-select-cart');
    if (vnoskiSelectEl) vnoskiSelectEl.addEventListener('change', recalculatePopup);

    const cancelBtn = document.getElementById('jet-cancel-btn-cart');
    if (cancelBtn) cancelBtn.addEventListener('click', closeJetPopup);

    // На количка няма бутон „Добави в количката“ – само Откажи и Купи на изплащане

    const buyOnCreditBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('jet-buy-on-credit-btn-cart'));
    const termsCheckbox = document.getElementById('jet-terms-checkbox-cart');
    const gdprCheckbox = document.getElementById('jet-gdpr-checkbox-cart');

    function updateBuyOnCreditButtonState() {
      if (!buyOnCreditBtn) return;
      const termsChecked = termsCheckbox instanceof HTMLInputElement ? termsCheckbox.checked : false;
      const gdprChecked = gdprCheckbox instanceof HTMLInputElement ? gdprCheckbox.checked : false;
      buyOnCreditBtn.disabled = !(termsChecked && gdprChecked);
    }

    if (termsCheckbox) termsCheckbox.addEventListener('change', updateBuyOnCreditButtonState);
    if (gdprCheckbox) gdprCheckbox.addEventListener('change', updateBuyOnCreditButtonState);
    updateBuyOnCreditButtonState();

    if (buyOnCreditBtn) {
      buyOnCreditBtn.addEventListener('click', function () {
        if (buyOnCreditBtn.disabled) return;
        const step1 = document.getElementById('jet-popup-step1-cart');
        const step2 = document.getElementById('jet-popup-step2-cart');
        const footerStep1 = document.getElementById('jet-popup-footer-step1-cart');
        const footerStep2 = document.getElementById('jet-popup-footer-step2-cart');
        if (step1) step1.style.display = 'none';
        if (step2) step2.style.display = 'flex';
        if (footerStep1) footerStep1.style.display = 'none';
        if (footerStep2) footerStep2.style.display = 'flex';
        setTimeout(updateStep2SubmitButtonState, 0);
      });
    }

    const step2BackBtn = document.getElementById('jet-step2-back-btn-cart');
    if (step2BackBtn) {
      step2BackBtn.addEventListener('click', function () {
        const step1 = document.getElementById('jet-popup-step1-cart');
        const step2 = document.getElementById('jet-popup-step2-cart');
        const footerStep1 = document.getElementById('jet-popup-footer-step1-cart');
        const footerStep2 = document.getElementById('jet-popup-footer-step2-cart');
        if (step1) step1.style.display = '';
        if (step2) step2.style.display = 'none';
        if (footerStep1) footerStep1.style.display = '';
        if (footerStep2) footerStep2.style.display = 'none';
      });
    }

    const step2CancelBtn = document.getElementById('jet-step2-cancel-btn-cart');
    if (step2CancelBtn) step2CancelBtn.addEventListener('click', closeJetPopup);

    // Стъпка 2: валидация и бутон Изпрати
    /**
     * Проверка дали всички условия за стъпка 2 са изпълнени.
     * Условия: попълнени Име и Фамилия, валидно ЕГН, телефон минимум 10 цифри,
     * валиден email, отметнат чекбокс за условията на ПБ Лични финанси.
     * При true активираме бутона Изпрати.
     * @returns {boolean}
     */
    function isStep2FormValid() {
      var firstname = document.getElementById('jet-step2-firstname-cart');
      var lastname = document.getElementById('jet-step2-lastname-cart');
      var egnInput = document.getElementById('jet-step2-egn-cart');
      var phone = document.getElementById('jet-step2-phone-cart');
      var email = document.getElementById('jet-step2-email-cart');
      var terms = document.getElementById('jet-step2-terms-checkbox-cart');
      if (!firstname || !lastname || !egnInput || !phone || !email || !terms) return false;
      if (!(firstname instanceof HTMLInputElement) || !(lastname instanceof HTMLInputElement) ||
        !(egnInput instanceof HTMLInputElement) || !(phone instanceof HTMLInputElement) ||
        !(email instanceof HTMLInputElement) || !(terms instanceof HTMLInputElement)) return false;

      var conditionName = (firstname.value || '').trim().length > 0 && (lastname.value || '').trim().length > 0;
      var conditionEgn = isValidEgn((egnInput.value || '').trim());
      var conditionPhone = (phone.value || '').replace(/\s/g, '').length >= 10;
      var conditionEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email.value || '').trim());
      var conditionTerms = terms.checked === true;

      return conditionName && conditionEgn && conditionPhone && conditionEmail && conditionTerms;
    }

    function updateStep2SubmitButtonState() {
      var btn = document.getElementById('jet-step2-submit-btn-cart');
      if (btn && btn instanceof HTMLButtonElement) {
        btn.disabled = !isStep2FormValid();
      }
    }

    /** Маркира невалидните полета в стъпка 2 с червена рамка */
    function highlightInvalidStep2Fields() {
      var firstname = document.getElementById('jet-step2-firstname-cart');
      var lastname = document.getElementById('jet-step2-lastname-cart');
      var egnInput = document.getElementById('jet-step2-egn-cart');
      var phone = document.getElementById('jet-step2-phone-cart');
      var email = document.getElementById('jet-step2-email-cart');
      /** @param {HTMLElement | null} el @param {boolean} invalid */
      function setError(el, invalid) {
        if (el && el.classList) {
          if (invalid) el.classList.add('jet-input-error');
          else el.classList.remove('jet-input-error');
        }
      }
      if (firstname instanceof HTMLInputElement) setError(firstname, (firstname.value || '').trim().length === 0);
      if (lastname instanceof HTMLInputElement) setError(lastname, (lastname.value || '').trim().length === 0);
      if (egnInput instanceof HTMLInputElement) setError(egnInput, !isValidEgn((egnInput.value || '').trim()));
      if (phone instanceof HTMLInputElement) setError(phone, (phone.value || '').replace(/\s/g, '').length < 10);
      if (email instanceof HTMLInputElement) setError(email, !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email.value || '').trim()));
    }

    /** @param {HTMLElement | null} el */
    function clearInputError(el) {
      if (el && el.classList) el.classList.remove('jet-input-error');
    }

    /* Проверка при излизане от всяко задължително поле и при промяна на чекбокса */
    var step2InputIds = ['jet-step2-firstname-cart', 'jet-step2-lastname-cart', 'jet-step2-egn-cart', 'jet-step2-phone-cart', 'jet-step2-email-cart'];
    step2InputIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('blur', updateStep2SubmitButtonState);
        el.addEventListener('focus', function () { clearInputError(el); });
      }
    });
    var egnEl = document.getElementById('jet-step2-egn-cart');
    if (egnEl && egnEl instanceof HTMLInputElement) {
      var egnInputRef = egnEl;
      egnEl.addEventListener('input', function () {
        egnInputRef.value = egnInputRef.value.replace(/\D/g, '').slice(0, 10);
      });
    }
    var step2Terms = document.getElementById('jet-step2-terms-checkbox-cart');
    if (step2Terms) step2Terms.addEventListener('change', updateStep2SubmitButtonState);

    const step2SubmitBtn = document.getElementById('jet-step2-submit-btn-cart');
    const step2SubmitWrap = document.getElementById('jet-step2-submit-wrap-cart');
    if (step2SubmitWrap) {
      step2SubmitWrap.addEventListener('click', function (e) {
        if (step2SubmitBtn && step2SubmitBtn instanceof HTMLButtonElement && step2SubmitBtn.disabled) {
          e.preventDefault();
          highlightInvalidStep2Fields();
        }
      });
    }
    if (step2SubmitBtn && step2SubmitBtn instanceof HTMLButtonElement) {
      step2SubmitBtn.disabled = true;
      step2SubmitBtn.addEventListener('click', function () {
        if (step2SubmitBtn.disabled) return;
        // TODO: изпращане на заявка
      });
    }
  }

  /**
   * Инициализира popup за бутона с кредитна карта (само ако jet_card_in е включен)
   */
  function initPopupCard() {
    const overlay = document.getElementById('jet-popup-overlay-card-cart');
    const container = document.getElementById('jet-cart-button-card-container');
    if (!overlay || !container) return;

    container.addEventListener('click', function () {
      openJetPopupCard();
    });

    var vnoskiSelect = document.getElementById('jet-vnoski-select-card-cart');
    var vnoskiDisplay = document.getElementById('jet-vnoski-display-card-cart');
    var vnoskiList = document.getElementById('jet-vnoski-list-card-cart');
    if (vnoskiSelect && vnoskiDisplay && vnoskiList && vnoskiSelect instanceof HTMLSelectElement) {
      for (var i = 0; i < vnoskiSelect.options.length; i++) {
        var opt = vnoskiSelect.options[i];
        if (!opt) continue;
        var div = document.createElement('div');
        div.className = 'jet-select-option';
        div.setAttribute('role', 'option');
        div.dataset.value = opt.value;
        div.textContent = opt.textContent || opt.value;
        vnoskiList.appendChild(div);
      }
      syncJetVnoskiDisplayCard();
      var listEl = vnoskiList;
      var selectEl = vnoskiSelect;
      vnoskiDisplay.addEventListener('click', function () {
        if (listEl) listEl.hidden = !listEl.hidden;
      });
      vnoskiList.addEventListener('click', function (e) {
        var t = e.target;
        if (t && t instanceof HTMLElement && t.classList.contains('jet-select-option') && t.dataset.value !== undefined) {
          if (t.classList.contains('jet-select-option--disabled')) return;
          if (selectEl && selectEl instanceof HTMLSelectElement) selectEl.value = t.dataset.value || '';
          if (selectEl) selectEl.dispatchEvent(new Event('change', { bubbles: true }));
          syncJetVnoskiDisplayCard();
          if (listEl) listEl.hidden = true;
        }
      });
      document.addEventListener('click', function closeListCard(e) {
        if (!listEl || listEl.hidden) return;
        var target = e.target instanceof Node ? e.target : null;
        if (target !== vnoskiDisplay && !listEl.contains(target)) listEl.hidden = true;
      });
    }

    var recalcCardBtn = document.getElementById('jet-recalculate-btn-card-cart');
    if (recalcCardBtn) recalcCardBtn.addEventListener('click', recalculatePopupCard);
    var parvaCardInput = document.getElementById('jet-parva-input-card-cart');
    if (parvaCardInput) parvaCardInput.addEventListener('blur', recalculatePopupCard);
    var vnoskiSelectCardEl = document.getElementById('jet-vnoski-select-card-cart');
    if (vnoskiSelectCardEl) vnoskiSelectCardEl.addEventListener('change', recalculatePopupCard);

    var cancelCardBtn = document.getElementById('jet-cancel-btn-card-cart');
    if (cancelCardBtn) cancelCardBtn.addEventListener('click', closeJetPopupCard);

    var buyOnCreditCardBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('jet-buy-on-credit-btn-card-cart'));
    var termsCard = document.getElementById('jet-terms-checkbox-card-cart');
    var gdprCard = document.getElementById('jet-gdpr-checkbox-card-cart');
    function updateBuyOnCreditCardState() {
      if (!buyOnCreditCardBtn) return;
      var termsOk = termsCard instanceof HTMLInputElement ? termsCard.checked : false;
      var gdprOk = gdprCard instanceof HTMLInputElement ? gdprCard.checked : false;
      buyOnCreditCardBtn.disabled = !(termsOk && gdprOk);
    }
    if (termsCard) termsCard.addEventListener('change', updateBuyOnCreditCardState);
    if (gdprCard) gdprCard.addEventListener('change', updateBuyOnCreditCardState);
    updateBuyOnCreditCardState();

    if (buyOnCreditCardBtn) {
      var buyOnCreditBtnRefCard = buyOnCreditCardBtn;
      buyOnCreditCardBtn.addEventListener('click', function () {
        if (buyOnCreditBtnRefCard.disabled) return;
        var s1 = document.getElementById('jet-popup-step1-card-cart');
        var s2 = document.getElementById('jet-popup-step2-card-cart');
        var f1 = document.getElementById('jet-popup-footer-step1-card-cart');
        var f2 = document.getElementById('jet-popup-footer-step2-card-cart');
        if (s1) s1.style.display = 'none';
        if (s2) s2.style.display = 'flex';
        if (f1) f1.style.display = 'none';
        if (f2) f2.style.display = 'flex';
        setTimeout(updateStep2SubmitButtonStateCard, 0);
      });
    }

    var step2BackCard = document.getElementById('jet-step2-back-btn-card-cart');
    if (step2BackCard) {
      step2BackCard.addEventListener('click', function () {
        var s1 = document.getElementById('jet-popup-step1-card-cart');
        var s2 = document.getElementById('jet-popup-step2-card-cart');
        var f1 = document.getElementById('jet-popup-footer-step1-card-cart');
        var f2 = document.getElementById('jet-popup-footer-step2-card-cart');
        if (s1) s1.style.display = '';
        if (s2) s2.style.display = 'none';
        if (f1) f1.style.display = '';
        if (f2) f2.style.display = 'none';
      });
    }
    var step2CancelCard = document.getElementById('jet-step2-cancel-btn-card-cart');
    if (step2CancelCard) step2CancelCard.addEventListener('click', closeJetPopupCard);

    function isStep2FormValidCard() {
      var fn = document.getElementById('jet-step2-firstname-card-cart');
      var ln = document.getElementById('jet-step2-lastname-card-cart');
      var egn = document.getElementById('jet-step2-egn-card-cart');
      var ph = document.getElementById('jet-step2-phone-card-cart');
      var em = document.getElementById('jet-step2-email-card-cart');
      var tr = document.getElementById('jet-step2-terms-checkbox-card-cart');
      if (!fn || !ln || !egn || !ph || !em || !tr) return false;
      if (!(fn instanceof HTMLInputElement) || !(ln instanceof HTMLInputElement) || !(egn instanceof HTMLInputElement) || !(ph instanceof HTMLInputElement) || !(em instanceof HTMLInputElement) || !(tr instanceof HTMLInputElement)) return false;
      var nameOk = (fn.value || '').trim().length > 0 && (ln.value || '').trim().length > 0;
      var egnOk = isValidEgn((egn.value || '').trim());
      var phoneOk = (ph.value || '').replace(/\s/g, '').length >= 10;
      var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((em.value || '').trim());
      var termsOk = tr.checked === true;
      return nameOk && egnOk && phoneOk && emailOk && termsOk;
    }
    function updateStep2SubmitButtonStateCard() {
      var btn = document.getElementById('jet-step2-submit-btn-card-cart');
      if (btn && btn instanceof HTMLButtonElement) btn.disabled = !isStep2FormValidCard();
    }
    function highlightInvalidStep2FieldsCard() {
      var fn = document.getElementById('jet-step2-firstname-card-cart');
      var ln = document.getElementById('jet-step2-lastname-card-cart');
      var egn = document.getElementById('jet-step2-egn-card-cart');
      var ph = document.getElementById('jet-step2-phone-card-cart');
      var em = document.getElementById('jet-step2-email-card-cart');
      /** @param {HTMLElement} el @param {boolean} inv */
      function setErr(el, inv) {
        if (el && el.classList) { if (inv) el.classList.add('jet-input-error'); else el.classList.remove('jet-input-error'); }
      }
      if (fn instanceof HTMLInputElement) setErr(fn, (fn.value || '').trim().length === 0);
      if (ln instanceof HTMLInputElement) setErr(ln, (ln.value || '').trim().length === 0);
      if (egn instanceof HTMLInputElement) setErr(egn, !isValidEgn((egn.value || '').trim()));
      if (ph instanceof HTMLInputElement) setErr(ph, (ph.value || '').replace(/\s/g, '').length < 10);
      if (em instanceof HTMLInputElement) setErr(em, !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((em.value || '').trim()));
    }
    /** @param {HTMLElement} el */
    function clearInputErrorCard(el) {
      if (el && el.classList) el.classList.remove('jet-input-error');
    }
    var step2InputIdsCard = ['jet-step2-firstname-card-cart', 'jet-step2-lastname-card-cart', 'jet-step2-egn-card-cart', 'jet-step2-phone-card-cart', 'jet-step2-email-card-cart'];
    step2InputIdsCard.forEach(function (id) {
      var el = document.getElementById(id);
      if (el instanceof HTMLElement) {
        var fieldEl = el;
        el.addEventListener('blur', updateStep2SubmitButtonStateCard);
        el.addEventListener('focus', function () { clearInputErrorCard(fieldEl); });
      }
    });
    var egnCardEl = document.getElementById('jet-step2-egn-card-cart');
    if (egnCardEl && egnCardEl instanceof HTMLInputElement) {
      var egnInputRefCard = egnCardEl;
      egnCardEl.addEventListener('input', function () {
        egnInputRefCard.value = egnInputRefCard.value.replace(/\D/g, '').slice(0, 10);
      });
    }
    var step2TermsCard = document.getElementById('jet-step2-terms-checkbox-card-cart');
    if (step2TermsCard) step2TermsCard.addEventListener('change', updateStep2SubmitButtonStateCard);

    var step2SubmitWrapCard = document.getElementById('jet-step2-submit-wrap-card-cart');
    var step2SubmitBtnCard = document.getElementById('jet-step2-submit-btn-card-cart');
    if (step2SubmitWrapCard) {
      step2SubmitWrapCard.addEventListener('click', function (e) {
        if (step2SubmitBtnCard && step2SubmitBtnCard instanceof HTMLButtonElement && step2SubmitBtnCard.disabled) {
          e.preventDefault();
          highlightInvalidStep2FieldsCard();
        }
      });
    }
    if (step2SubmitBtnCard && step2SubmitBtnCard instanceof HTMLButtonElement) {
      var submitBtnRefCard = step2SubmitBtnCard;
      step2SubmitBtnCard.disabled = true;
      step2SubmitBtnCard.addEventListener('click', function () {
        if (submitBtnRefCard.disabled) return;
        // TODO: изпращане на заявка (карта)
      });
    }
  }

  function init() {
    const container = document.getElementById('jet-cart-button-container');
    if (!container) return;

    jet_parva = parseFloat(container.dataset.jetParva || '0') || 0;

    const productPrice = parseFloat(container.dataset.productPrice || '0');
    if (productPrice) {
      updateVnoskaText(productPrice, jet_parva);
    }

    container.addEventListener('click', function () {
      openJetPopup();
    });

    initPopup();
    if (document.getElementById('jet-popup-overlay-card-cart') && document.getElementById('jet-cart-button-card-container')) {
      initPopupCard();
    }

    // На страница количка няма промяна на вариант/количество – цената е общата сума в количката

    const jetCart = {};
    jetCart.calculateVnoski = calculateVnoski;
    jetCart.calculateJetVnoska = calculateJetVnoska;
    jetCart.formatEuro = formatEuro;
    jetCart.updateVnoskaText = updateVnoskaText;
    jetCart.setJetParva = setJetParva;
    jetCart.getJetParva = function () {
      return jet_parva;
    };
    // @ts-ignore
    window.jetCart = jetCart;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
