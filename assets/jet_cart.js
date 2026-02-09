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
   * Показва кастомен alert (чист JS, без jQuery). Еднакъв вид за всички модули.
   * @param {string} message - Текст за показване
   * @param {boolean|function(): void} [exit] - Ако е true или функция: при клик на „Добре“ се извиква функцията (или затваряне на попъпа). Ако е функция, тя се извиква при затваряне.
   * @returns {void}
   */
  function jetShowCustomAlert(message, exit) {
    var jetAlertBox = document.createElement('div');
    jetAlertBox.id = 'jet_alert_box';
    jetAlertBox.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:20px;border-radius:5px;box-shadow:0 0 10px rgba(0,0,0,0.1);z-index:5000001;width:300px;text-align:center;';
    var jetMessageText = document.createElement('p');
    jetMessageText.textContent = message;
    jetMessageText.style.cssText = 'color:#14532d;margin:0;';
    jetAlertBox.appendChild(jetMessageText);
    var jetCloseButton = document.createElement('button');
    jetCloseButton.textContent = 'Добре';
    jetCloseButton.type = 'button';
    jetCloseButton.style.cssText = 'font-weight:500;margin-top:20px;padding:10px 20px;border:none;background:#166534;color:#fff;border-radius:3px;cursor:pointer;';
    jetCloseButton.addEventListener('click', function () {
      if (jetAlertBox.parentNode) jetAlertBox.parentNode.removeChild(jetAlertBox);
      var overlay = document.getElementById('jet_alert_overlay');
      if (overlay) overlay.classList.remove('show');
      if (typeof exit === 'function') exit();
      else if (exit) closeJetPopup();
    });
    jetAlertBox.appendChild(jetCloseButton);
    document.body.appendChild(jetAlertBox);
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

    // Проверяваме дали трябва да показваме BGN (от снипета се подава в data атрибут или от настройките)
    const showBgn = container.dataset.jetSecondaryCurrency === 'true';
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

    /** Връща HTML за ред вноска: основен текст + опционално span с лв. (по-малък шрифт) */
    /** @param {string} jetVnoskaFormatted @param {number} jetVnoskaCents */
    function vnoskaLineContent(jetVnoskaFormatted, jetVnoskaCents) {
      var main = vnoskiResolved + ' x ' + jetVnoskaFormatted + ' €';
      if (showBgn) {
        var bgn = (jetVnoskaCents / 100) * JET_EUR_TO_BGN;
        return main + ' <span class="jet-vnoska-bgn">(' + bgn.toFixed(2) + ' лв.)</span>';
      }
      return main;
    }

    // Обновяваме елементите за редовен лизинг (използва jet_purcent)
    const regularElements = document.querySelectorAll('.jet-vnoska-regular');
    regularElements.forEach(function (element) {
      if (element instanceof HTMLElement) {
        const jetPurcent = parseFloat(element.dataset.jetPurcent || '0') || 0;
        const jetVnoskaCents = calculateJetVnoska(jetTotalCreditPrice, vnoskiResolved, jetPurcent);
        const jetVnoskaFormatted = formatEuro(jetVnoskaCents);
        var content = vnoskaLineContent(jetVnoskaFormatted, jetVnoskaCents);
        if (showBgn) {
          element.innerHTML = content;
        } else {
          element.textContent = content;
        }
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
        var content = vnoskaLineContent(jetVnoskaFormatted, jetVnoskaCents);
        if (showBgn) {
          element.innerHTML = content;
        } else {
          element.textContent = content;
        }
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
    // Запазваме само избрания брой вноски от попъпа (първоначалната вноска винаги се нулира)
    var vnoskiSelect = document.getElementById('jet-vnoski-select-cart');
    var currentVnoski = undefined;
    if (vnoskiSelect && vnoskiSelect instanceof HTMLSelectElement) {
      currentVnoski = parseInt(vnoskiSelect.value || '12', 10) || 12;
    }
    // Нулираме първоначалната вноска (и в попъпа, и в глобалната променлива)
    jet_parva = 0;
    var parvaInput = document.getElementById('jet-parva-input-cart');
    if (parvaInput && parvaInput instanceof HTMLInputElement) {
      parvaInput.value = '0';
    }
    // Обновяваме текста под бутона: запазваме избрания брой вноски, но нулираме първоначалната вноска
    var container = document.getElementById('jet-cart-button-container');
    if (container) {
      var productPrice = parseFloat(container.dataset.productPrice || '0');
      if (productPrice) {
        // Запазваме избрания брой вноски, но винаги нулираме първоначалната вноска (0)
        updateVnoskaText(productPrice, 0, currentVnoski);
      }
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

  /** Изчиства количката в Shopify след успешно изпращане на заявката */
  function clearShopifyCart() {
    fetch('/cart/clear.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
      .then(function (res) {
        if (res.ok) {
          // Презареждаме страницата за да се обнови количката визуално (ако има cart drawer/icon)
          // Може да се използва и custom event за обновяване на UI без reload
          if (typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent('cart:cleared'));
          }
        } else {
          console.warn('[Jet] Failed to clear cart:', res.status);
        }
      })
      .catch(function (err) {
        console.warn('[Jet] Error clearing cart:', err);
      });
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
    // Запазваме само избрания брой вноски от попъпа (първоначалната вноска винаги се нулира)
    var vnoskiSelectCard = document.getElementById('jet-vnoski-select-card-cart');
    var currentVnoskiCard = undefined;
    if (vnoskiSelectCard && vnoskiSelectCard instanceof HTMLSelectElement) {
      currentVnoskiCard = parseInt(vnoskiSelectCard.value || '12', 10) || 12;
    }
    // Нулираме първоначалната вноска в попъпа
    var parvaInputCard = document.getElementById('jet-parva-input-card-cart');
    if (parvaInputCard && parvaInputCard instanceof HTMLInputElement) {
      parvaInputCard.value = '0';
    }
    // Обновяваме текста под бутона за картата: запазваме избрания брой вноски, но нулираме първоначалната вноска
    var containerCard = document.getElementById('jet-cart-button-card-container');
    if (containerCard) {
      var productPriceCard = parseFloat(containerCard.dataset.productPrice || '0');
      if (productPriceCard) {
        // Запазваме избрания брой вноски, но винаги нулираме първоначалната вноска (0)
        updateVnoskaText(productPriceCard, 0, currentVnoskiCard);
      }
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

        // Блокираме бутона и показваме лоадер
        step2SubmitBtn.disabled = true;
        var originalText = step2SubmitBtn.textContent || '';
        step2SubmitBtn.innerHTML = '<span class="jet-loader-spinner"></span> Изпращане...';
        step2SubmitBtn.classList.add('jet-btn-loading');

        sendJetRequestToAppCart(false)
          .then(function () {
            // Успешно изпратено - бутонът остава блокиран, попъпът се затваря
          })
          .catch(function (err /** @type {any} */) {
            // При грешка разблокираме бутона и връщаме оригиналния текст
            if (step2SubmitBtn) {
              step2SubmitBtn.disabled = false;
              step2SubmitBtn.textContent = originalText;
              step2SubmitBtn.classList.remove('jet-btn-loading');
            }
          });
      });
    }
  }

  /**
   * Изпраща POST заявка към приложението (app) с всички полета и items от количката.
   * @param {boolean} [isCard=false] true ако изпращаме от попъпа за кредитна карта
   */
  function sendJetRequestToAppCart(isCard) {
    var container = isCard
      ? document.getElementById('jet-cart-button-card-container')
      : document.getElementById('jet-cart-button-container');
    if (!container) return Promise.reject(new Error('Container not found'));

    var jetId = (container.dataset.jetId || '').trim();
    var shopDomain = (container.dataset.shopDomain || '').trim();
    var shopPermanentDomain = (container.dataset.shopPermanentDomain || '').trim();
    var jetEmailPbpf = (container.dataset.jetEmailPbpf || '').trim();
    var jetEmailShop = (container.dataset.jetEmailShop || '').trim();
    var jetParva = (container.dataset.jetParva ?? '0').toString().trim();
    var primaryUrl = (container.dataset.jetPrimaryUrl || '').trim();
    var secondaryUrl = (container.dataset.jetSecondaryUrl || '').trim();

    var firstnameId = isCard ? 'jet-step2-firstname-card-cart' : 'jet-step2-firstname-cart';
    var lastnameId = isCard ? 'jet-step2-lastname-card-cart' : 'jet-step2-lastname-cart';
    var egnId = isCard ? 'jet-step2-egn-card-cart' : 'jet-step2-egn-cart';
    var phoneId = isCard ? 'jet-step2-phone-card-cart' : 'jet-step2-phone-cart';
    var emailId = isCard ? 'jet-step2-email-card-cart' : 'jet-step2-email-cart';
    var vnoskiSelectId = isCard ? 'jet-vnoski-select-card-cart' : 'jet-vnoski-select-cart';
    var vnoskaInputId = isCard ? 'jet-monthly-vnoska-input-card-cart' : 'jet-monthly-vnoska-input-cart';
    var parvaInputId = isCard ? 'jet-parva-input-card-cart' : 'jet-parva-input-cart';

    var firstnameEl = document.getElementById(firstnameId);
    var lastnameEl = document.getElementById(lastnameId);
    var egnEl = document.getElementById(egnId);
    var phoneEl = document.getElementById(phoneId);
    var emailEl = document.getElementById(emailId);
    var firstname = (firstnameEl instanceof HTMLInputElement && firstnameEl.value) ? firstnameEl.value.trim() : '';
    var lastname = (lastnameEl instanceof HTMLInputElement && lastnameEl.value) ? lastnameEl.value.trim() : '';
    var egn = (egnEl instanceof HTMLInputElement && egnEl.value) ? egnEl.value.trim() : '';
    var phone = (phoneEl instanceof HTMLInputElement && phoneEl.value) ? phoneEl.value.trim() : '';
    var email = (emailEl instanceof HTMLInputElement && emailEl.value) ? emailEl.value.trim() : '';
    var vnoskiSelectEl = document.getElementById(vnoskiSelectId);
    var jetVnoski = (vnoskiSelectEl instanceof HTMLSelectElement && vnoskiSelectEl.value) ? vnoskiSelectEl.value.trim() : '';
    var jetVnoska = getEuroFromEuroBgnField(vnoskaInputId).toFixed(2);
    var parvaInputEl = document.getElementById(parvaInputId);
    var jetParvaFromInput = (parvaInputEl instanceof HTMLInputElement && parvaInputEl.value) ? parvaInputEl.value.trim() : jetParva;

    // Вземаме продуктите от количката чрез Shopify Cart API
    return fetch('/cart.js')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (cartData) {
        if (!cartData || !cartData.items || cartData.items.length === 0) {
          console.warn('[Jet] Cart is empty');
          throw new Error('Cart is empty');
        }

        // Създаваме масив от items с всички продукти от количката
        // В items изпращаме единичните цени, не общите
        var items = [];
        var calculatedTotalCents = 0;

        for (var i = 0; i < cartData.items.length; i++) {
          var item = cartData.items[i];
          if (!item) continue;

          var productId = item.product_id ? String(item.product_id) : '';
          var productTitle = item.product_title || item.title || '';
          var variantTitle = item.variant_title || '';
          var quantity = item.quantity || 1;

          // Единичната цена (final_price е цената за един продукт след отстъпки)
          var unitPriceCents = item.final_price || item.price || 0;
          var unitPriceEur = (unitPriceCents / 100.0).toFixed(2);

          // Изчисляваме общата сума за проверка (единична цена × количество)
          var linePriceCents = unitPriceCents * quantity;
          calculatedTotalCents += linePriceCents;

          items.push({
            jet_product_id: productId,
            product_c_txt: productTitle,
            att_name: variantTitle || undefined,
            product_p_txt: unitPriceEur, // Единична цена
            jet_quantity: String(quantity)
          });
        }

        // Проверка/тест: дали сумата от единичните цени × количества съвпада с общата цена на количката
        var cartTotalCents = cartData.total_price || 0;
        if (Math.abs(calculatedTotalCents - cartTotalCents) > 1) {
          console.warn('[Jet] Price validation failed: calculated total=' + calculatedTotalCents + ' cents, cart total=' + cartTotalCents + ' cents (difference: ' + (cartTotalCents - calculatedTotalCents) + ' cents)');
          // Не коригираме нищо, само логваме предупреждение
        }

        if (!primaryUrl) {
          console.log('[Jet] Debug: jet_id=', jetId, '(primary URL не е зададен в снипета)');
          throw new Error('Primary URL not set');
        }

        var payload = {
          jet_id: jetId,
          shop_domain: shopDomain,
          shop_permanent_domain: shopPermanentDomain,
          'jet-step2-firstname': firstname,
          'jet-step2-lastname': lastname,
          'jet-step2-egn': egn,
          'jet-step2-phone': phone,
          'jet-step2-email': email,
          items: items,
          jet_card: !!isCard,
          jet_parva: jetParvaFromInput,
          jet_vnoski: jetVnoski,
          jet_vnoska: jetVnoska,
          jet_email_pbpf: jetEmailPbpf,
          jet_email_shop: jetEmailShop
        };

        var body = JSON.stringify(payload);
        var opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body };

        /** @param {string} url */
        function doFetch(url) {
          return fetch(url, opts)
            .then(function (res) {
              if (!res.ok) throw new Error('HTTP ' + res.status);
              return res.json();
            });
        }

        return doFetch(primaryUrl)
          .then(function (data) {
            // Изчистваме количката след успешно изпращане (заявката е от количката)
            clearShopifyCart();
            jetShowCustomAlert('Успешно изпратихте Вашата заявка за лизинг към ПБ Лични Финанси. Очаквайте контакт за потвърждаване на направената от Вас заявка.', function () {
              if (isCard) closeJetPopupCard(); else closeJetPopup();
              // Презареждаме страницата за да се обнови количката визуално
              setTimeout(function () {
                window.location.reload();
              }, 300);
            });
            return true;
          })
          .catch(function (err) {
            console.warn('[Jet] Primary failed:', err);
            if (secondaryUrl && secondaryUrl !== primaryUrl) {
              return doFetch(secondaryUrl)
                .then(function (data) {
                  console.log('[Jet] App response (fallback):', data);
                  // Изчистваме количката след успешно изпращане (заявката е от количката)
                  clearShopifyCart();
                  jetShowCustomAlert('Заявката е изпратена успешно. Ще се свържем с вас скоро.', function () {
                    if (isCard) closeJetPopupCard(); else closeJetPopup();
                    // Презареждаме страницата за да се обнови количката визуално
                    setTimeout(function () {
                      window.location.reload();
                    }, 300);
                  });
                  return true;
                })
                .catch(function (err2) {
                  console.warn('[Jet] Fallback failed:', err2);
                  throw err2;
                });
            }
            throw err;
          });
      })
      .catch(function (err) {
        console.error('[Jet] Failed to fetch cart:', err);
        throw err;
      });
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

        // Блокираме бутона и показваме лоадер
        submitBtnRefCard.disabled = true;
        var originalText = submitBtnRefCard.textContent || '';
        submitBtnRefCard.innerHTML = '<span class="jet-loader-spinner"></span> Изпращане...';
        submitBtnRefCard.classList.add('jet-btn-loading');

        sendJetRequestToAppCart(true)
          .then(function () {
            // Успешно изпратено - бутонът остава блокиран, попъпът се затваря
          })
          .catch(function (err /** @type {any} */) {
            // При грешка разблокираме бутона и връщаме оригиналния текст
            if (submitBtnRefCard) {
              submitBtnRefCard.disabled = false;
              submitBtnRefCard.textContent = originalText;
              submitBtnRefCard.classList.remove('jet-btn-loading');
            }
          });
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

    // Функция за обновяване на цената от количката
    function updateCartTotal() {
      // Изчакваме малко за да се обнови DOM-ът от framework-а
      setTimeout(function () {
        var cartTotalCents = 0;

        // Метод 1: Опитваме се да вземем общата сума от различни селектори в DOM-а
        var selectors = [
          '[data-cart-total]',
          '.cart-total',
          '.cart__total',
          '[id*="cart-total"]',
          '[id*="cartTotal"]',
          '.cart-summary [data-total-price]',
          '.cart-summary .total-price',
          'cart-totals [data-total-price]',
          'cart-totals .total-price'
        ];

        for (var i = 0; i < selectors.length; i++) {
          var selector = selectors[i];
          if (!selector) continue;
          var cartTotalEl = document.querySelector(selector);
          if (cartTotalEl) {
            // Първо проверяваме data атрибути (те са вече в центове)
            var dataTotal = cartTotalEl.getAttribute('data-cart-total') ||
              cartTotalEl.getAttribute('data-total-price') ||
              cartTotalEl.getAttribute('data-total');
            if (dataTotal) {
              var num = parseFloat(dataTotal);
              if (!isNaN(num) && num > 0) {
                // Data атрибутите са вече в центове, не умножаваме
                cartTotalCents = Math.round(num);
                break;
              }
            }

            // Ако няма data атрибут, опитваме се да извлечем от текста
            var totalText = cartTotalEl.textContent || '';
            if (totalText) {
              // Премахваме всичко освен числа, точка и запетая
              var priceMatch = totalText.replace(/[^\d,.]/g, '');

              if (priceMatch) {
                // Обработваме формат като "2.020,00" (точка за хиляди, запетая за десетични)
                if (priceMatch.includes(',')) {
                  // Европейски формат: "2.020,00" -> премахваме точките, заменяме запетаята с точка
                  priceMatch = priceMatch.replace(/\./g, '').replace(',', '.');
                } else if (priceMatch.includes('.')) {
                  // Английски формат: "2020.00" или "2.020.00"
                  var parts = priceMatch.split('.');
                  var secondPart = parts[1];
                  // Ако втората част е 2 цифри, това е десетична част
                  if (!(parts.length === 2 && secondPart && secondPart.length <= 2)) {
                    // Иначе точките са за хиляди, премахваме ги
                    priceMatch = priceMatch.replace(/\./g, '');
                  }
                }

                var priceValue = parseFloat(priceMatch);
                if (!isNaN(priceValue) && priceValue > 0) {
                  // Винаги конвертираме от евро в центове (умножаваме по 100)
                  cartTotalCents = Math.round(priceValue * 100);
                  break;
                }
              }
            }
          }
        }

        // Метод 2: От data атрибут на контейнера (ако вече е обновен)
        if (cartTotalCents === 0 && container) {
          var currentPrice = parseFloat(container.dataset.productPrice || '0');
          if (currentPrice > 0) {
            cartTotalCents = currentPrice;
          }
        }

        // Ако намерихме нова сума и е различна от текущата, обновяваме
        if (cartTotalCents > 0 && container) {
          var currentPrice = parseFloat(container.dataset.productPrice || '0');
          if (cartTotalCents !== currentPrice) {
            container.dataset.productPrice = String(cartTotalCents);
            // Обновяваме и картата контейнера ако съществува
            var containerCard = document.getElementById('jet-cart-button-card-container');
            if (containerCard) {
              containerCard.dataset.productPrice = String(cartTotalCents);
            }
            updateVnoskaText(cartTotalCents, jet_parva);

            // Ако popup-ът е отворен, обновяваме го
            const overlay = document.getElementById('jet-popup-overlay-cart');
            if (overlay && overlay.style.display === 'flex') {
              setTimeout(function () {
                openJetPopup();
              }, 100);
            }
            const overlayCard = document.getElementById('jet-popup-overlay-card-cart');
            if (overlayCard && overlayCard.style.display === 'flex') {
              setTimeout(function () {
                openJetPopupCard();
              }, 100);
            }
          }
        }
      }, 300);
    }

    // Прихващаме промяна на количеството в количката
    function handleCartQuantityChange() {
      updateCartTotal();
    }

    // Прихващаме change event за input полетата за количество
    document.addEventListener('change', function (event) {
      const target = event.target;
      if (target instanceof HTMLInputElement && (target.name === 'updates[]' || target.name.includes('updates'))) {
        handleCartQuantityChange();
      }
    }, true);

    // Прихващаме input event за по-бърза реакция
    document.addEventListener('input', function (event) {
      const target = event.target;
      if (target instanceof HTMLInputElement && (target.name === 'updates[]' || target.name.includes('updates'))) {
        handleCartQuantityChange();
      }
    }, true);

    // Прихващаме click събития на бутоните за количество в cart-quantity-selector-component
    document.addEventListener('click', function (event) {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const button = target.closest('button[name="plus"], button[name="minus"]');
        if (button && button instanceof HTMLButtonElement) {
          const quantitySelector = button.closest('cart-quantity-selector-component');
          if (quantitySelector) {
            handleCartQuantityChange();
          }
        }
      }
    }, true);

    // MutationObserver за да следя промени в value атрибута на input полетата за количество
    function setupCartQuantityObserver() {
      var quantityInputs = document.querySelectorAll('input[name="updates[]"], input[type="number"][name*="updates"]');
      if (quantityInputs.length === 0) {
        // Ако още няма input полета, опитваме се отново след малко
        setTimeout(setupCartQuantityObserver, 500);
        return;
      }

      quantityInputs.forEach(function (quantityInput) {
        if (!(quantityInput instanceof HTMLInputElement)) return;

        var lastValue = quantityInput.value || '1';
        var observer = new MutationObserver(function (mutations) {
          mutations.forEach(function (mutation) {
            if (mutation.type === 'attributes' && (mutation.attributeName === 'value' || mutation.attributeName === 'data-cart-quantity')) {
              var target = mutation.target;
              if (!(target instanceof HTMLInputElement)) return;
              var currentValue = target.value || target.getAttribute('data-cart-quantity') || '1';
              if (currentValue !== lastValue) {
                lastValue = currentValue;
                handleCartQuantityChange();
              }
            }
          });
        });

        observer.observe(quantityInput, {
          attributes: true,
          attributeFilter: ['value', 'data-cart-quantity']
        });

        // Също следя промени в самия cart-quantity-selector-component
        var quantitySelector = quantityInput.closest('cart-quantity-selector-component');
        if (quantitySelector) {
          observer.observe(quantitySelector, {
            attributes: true,
            childList: true,
            subtree: true
          });
        }
      });
    }
    setupCartQuantityObserver();

    // MutationObserver за да следя промени в общата сума на количката
    function setupCartTotalObserver() {
      var cartTotalEl = document.querySelector('[data-cart-total], .cart-total, .cart__total, [id*="cart-total"], [id*="cartTotal"]');
      if (!cartTotalEl) {
        setTimeout(setupCartTotalObserver, 500);
        return;
      }

      var lastText = cartTotalEl.textContent || '';
      var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            var el = cartTotalEl;
            if (!el) return;
            var currentText = el.textContent || '';
            if (currentText !== lastText) {
              lastText = currentText;
              handleCartQuantityChange();
            }
          }
        });
      });

      observer.observe(cartTotalEl, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
    setupCartTotalObserver();

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
