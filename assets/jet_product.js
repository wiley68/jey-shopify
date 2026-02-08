/**
 * Jet Product – стилове и действия за бутона/лизинга
 */
(function () {
  // Първоначална вноска (в центове, по подразбиране 0)
  let jet_parva = 0;

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
    const container = document.getElementById('jet-product-button-container');
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
    const container = document.getElementById('jet-product-button-container');
    if (container) {
      const productPrice = parseFloat(container.dataset.productPrice || '0');
      if (productPrice) {
        updateVnoskaText(productPrice, jet_parva);
      }
    }
  }

  /**
   * Извлича цената на варианта от различни източници
   * @returns {number} Цената в центове или 0 ако не може да се намери
   */
  function getVariantPrice() {
    // Метод 1: От JSON скрипта на варианта (най-надеждно)
    const variantScripts = document.querySelectorAll('form script[type="application/json"]');
    for (let i = 0; i < variantScripts.length; i++) {
      const script = variantScripts[i];
      if (!script) continue;
      try {
        const scriptText = script.textContent;
        if (!scriptText) continue;
        const variantData = JSON.parse(scriptText);
        if (variantData && variantData.price && variantData.price > 0) {
          return variantData.price; // Цената вече е в центове
        }
      } catch (e) {
        // Игнорираме грешки при парсване
      }
    }

    // Метод 2: От data-variant-id на избрания radio бутон
    const checkedRadio = document.querySelector('input[type="radio"][name*="variant"]:checked, input[type="radio"][name*="Color"]:checked, input[type="radio"][name*="Size"]:checked');
    if (checkedRadio && checkedRadio instanceof HTMLInputElement) {
      const variantId = checkedRadio.getAttribute('data-variant-id');
      if (variantId) {
        // Търсим JSON скрипта с този variant ID
        for (let i = 0; i < variantScripts.length; i++) {
          const script = variantScripts[i];
          if (!script) continue;
          try {
            const scriptText = script.textContent;
            if (!scriptText) continue;
            const variantData = JSON.parse(scriptText);
            if (variantData && variantData.id && variantData.price && String(variantData.id) === String(variantId)) {
              return variantData.price;
            }
          } catch (e) {
            // Игнорираме грешки при парсване
          }
        }
      }
    }

    // Метод 3: От DOM елемента с цената
    const priceElement = document.querySelector('product-price .price, .price');
    if (priceElement) {
      const priceText = priceElement.textContent || '';
      // Премахваме всичко освен числа и точка/запетая
      let priceMatch = priceText.replace(/[^\d,.]/g, '');

      // Обработваме формат като "€1.000,00" (точка за хиляди, запетая за десетични)
      if (priceMatch.includes(',')) {
        priceMatch = priceMatch.replace(/\./g, '').replace(',', '.');
      } else if (priceMatch.includes('.')) {
        const parts = priceMatch.split('.');
        const secondPart = parts[1];
        if (!(parts.length === 2 && secondPart && secondPart.length <= 2)) {
          priceMatch = priceMatch.replace(/\./g, '');
        }
      }

      const priceValue = parseFloat(priceMatch);
      if (!isNaN(priceValue) && priceValue > 0) {
        return Math.round(priceValue * 100); // Конвертираме от евро в центове
      }
    }

    return 0;
  }

  /**
   * Връща ID на текущо избрания вариант (за добавяне в количката)
   * @returns {number|string|null} Variant ID или null
   */
  function getCurrentVariantId() {
    var form = document.querySelector('form[action*="cart/add"], form[data-type="add-to-cart-form"]');
    if (form) {
      var idInput = form.querySelector('input[name="id"]');
      if (idInput && idInput instanceof HTMLInputElement && idInput.value) return idInput.value;
    }
    var checkedRadio = document.querySelector('input[type="radio"][name*="variant"]:checked, input[type="radio"][name*="Color"]:checked, input[type="radio"][name*="Size"]:checked');
    if (checkedRadio && checkedRadio.getAttribute('data-variant-id')) {
      return checkedRadio.getAttribute('data-variant-id');
    }
    var variantScripts = document.querySelectorAll('form script[type="application/json"]');
    for (var s = 0; s < variantScripts.length; s++) {
      var scriptEl = variantScripts[s];
      if (!scriptEl) continue;
      try {
        var data = JSON.parse(scriptEl.textContent || '{}');
        if (data && data.id) return data.id;
      } catch (e) { }
    }
    var container = document.getElementById('jet-product-button-container');
    if (container && container.dataset.variantId) return container.dataset.variantId;
    return null;
  }

  /**
   * Добавя продукта в количката и пренасочва към /cart
   * @returns {Promise<boolean>} true при успех, false при грешка или липсващ variant
   */
  function addCurrentProductToCartAndGoToCart() {
    var variantId = getCurrentVariantId();
    if (!variantId) return Promise.resolve(false);
    var quantityInput = document.querySelector('input[name="quantity"], input[type="number"][name*="quantity"]');
    var quantity = 1;
    if (quantityInput && quantityInput instanceof HTMLInputElement) {
      var q = parseInt(quantityInput.value, 10);
      if (!isNaN(q) && q > 0) quantity = q;
    }
    var shopify = typeof window !== 'undefined' ? /** @type {{ routes?: { root?: string } } | undefined} */ (window['Shopify']) : undefined;
    var shopifyRoot = (shopify && shopify.routes && shopify.routes.root) ? shopify.routes.root : '';
    var cartAddUrl = shopifyRoot + 'cart/add.js';
    return fetch(cartAddUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ id: variantId, quantity: quantity }] })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var status;
        if (data && typeof data === 'object' && 'status' in data) status = /** @type {{ status: number }} */ (data).status;
        if (status === 422) return false;
        var cartUrl = shopifyRoot + 'cart';
        window.location.href = cartUrl;
        return true;
      })
      .catch(function () { return false; });
  }

  /**
   * Обновява цената и вноските при промяна на вариант
   */
  function updatePriceFromVariant() {
    const container = document.getElementById('jet-product-button-container');
    if (!container) return;

    const oldPrice = parseFloat(container.dataset.productPrice || '0');

    // Изчакваме малко за да Shopify обнови DOM-а
    setTimeout(function () {
      const newPrice = getVariantPrice();

      if (newPrice > 0 && newPrice !== oldPrice) {
        // Обновяваме цената в контейнера
        container.dataset.productPrice = String(newPrice);

        // Обновяваме вноските
        updateVnoskaText(newPrice, jet_parva);
      }
    }, 300); // Изчакваме 300ms за да Shopify обнови цената в DOM
  }

  /**
   * Отваря popup прозореца за лизинг
   */
  function openJetPopup() {
    const overlay = document.getElementById('jet-popup-overlay');
    if (!overlay) return;

    const container = document.getElementById('jet-product-button-container');
    if (!container) return;

    // Вземаме актуалната цена (включително опциите и количеството)
    let productPrice = getVariantPrice();

    // Ако не можем да вземем цената от варианта, използваме тази от контейнера
    if (!productPrice || productPrice === 0) {
      productPrice = parseFloat(container.dataset.productPrice || '0');
    }

    // Вземаме количеството от формата (ако има)
    const quantityInput = document.querySelector('input[name="quantity"], input[type="number"][name*="quantity"]');
    let quantity = 1;
    if (quantityInput && quantityInput instanceof HTMLInputElement) {
      quantity = parseInt(quantityInput.value) || 1;
    }

    // Умножаваме цената по количеството
    productPrice = productPrice * quantity;

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
    const step1 = document.getElementById('jet-popup-step1');
    const step2 = document.getElementById('jet-popup-step2');
    const footerStep1 = document.getElementById('jet-popup-footer-step1');
    const footerStep2 = document.getElementById('jet-popup-footer-step2');
    if (step1) step1.style.display = '';
    if (step2) step2.style.display = 'none';
    if (footerStep1) footerStep1.style.display = '';
    if (footerStep2) footerStep2.style.display = 'none';

    overlay.style.display = 'flex';

    const vnoskiListEl = document.getElementById('jet-vnoski-list');
    if (vnoskiListEl) vnoskiListEl.hidden = true;

    // Обновяваме стойностите в popup-а след показване, за да се визуализира select-ът правилно
    updatePopupValues(productPrice, currentParva, currentVnoski, jetPurcent);
  }

  /**
   * Затваря popup прозореца и връща към стъпка 1
   */
  function closeJetPopup() {
    const overlay = document.getElementById('jet-popup-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
    /* Изчистване на полетата и чекбокса на стъпка 2 */
    var step2Ids = ['jet-step2-firstname', 'jet-step2-lastname', 'jet-step2-egn', 'jet-step2-phone', 'jet-step2-email'];
    step2Ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el instanceof HTMLInputElement) {
        el.value = '';
        el.classList.remove('jet-input-error');
      }
    });
    var termsCheck = document.getElementById('jet-step2-terms-checkbox');
    if (termsCheck && termsCheck instanceof HTMLInputElement) {
      termsCheck.checked = false;
    }
    var step2SubmitBtn = document.getElementById('jet-step2-submit-btn');
    if (step2SubmitBtn && step2SubmitBtn instanceof HTMLButtonElement) {
      step2SubmitBtn.disabled = true;
    }
    const step1 = document.getElementById('jet-popup-step1');
    const step2 = document.getElementById('jet-popup-step2');
    const footerStep1 = document.getElementById('jet-popup-footer-step1');
    const footerStep2 = document.getElementById('jet-popup-footer-step2');
    if (step1) step1.style.display = '';
    if (step2) step2.style.display = 'none';
    if (footerStep1) footerStep1.style.display = '';
    if (footerStep2) footerStep2.style.display = 'none';
    var termsCheckbox = document.getElementById('jet-terms-checkbox');
    var gdprCheckbox = document.getElementById('jet-gdpr-checkbox');
    if (termsCheckbox && termsCheckbox instanceof HTMLInputElement) {
      termsCheckbox.checked = false;
      termsCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (gdprCheckbox && gdprCheckbox instanceof HTMLInputElement) {
      gdprCheckbox.checked = false;
      gdprCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    }
    jet_parva = 0;
    var parvaInput = document.getElementById('jet-parva-input');
    if (parvaInput && parvaInput instanceof HTMLInputElement) {
      parvaInput.value = '0';
    }
    var container = document.getElementById('jet-product-button-container');
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
  function updatePopupValues(productPrice, parva, vnoski, jetPurcent) {
    const container = document.getElementById('jet-product-button-container');
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
    const parvaInput = document.getElementById('jet-parva-input');
    if (parvaInput && parvaInput instanceof HTMLInputElement) {
      parvaInput.value = String(Math.round(parvaEuro));
    }

    const productPriceInput = document.getElementById('jet-product-price-input');
    if (productPriceInput && productPriceInput instanceof HTMLInputElement) {
      productPriceInput.value = productPriceEuro.toFixed(2);
    }

    const vnoskiSelect = document.getElementById('jet-vnoski-select');
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

    const totalCreditInput = document.getElementById('jet-total-credit-input');
    if (totalCreditInput && totalCreditInput instanceof HTMLInputElement) {
      totalCreditInput.value = totalCreditPriceEuro.toFixed(2);
    }

    const monthlyVnoskaInput = document.getElementById('jet-monthly-vnoska-input');
    if (monthlyVnoskaInput && monthlyVnoskaInput instanceof HTMLInputElement) {
      monthlyVnoskaInput.value = monthlyVnoskaEuro.toFixed(2);
    }

    const totalPaymentsInput = document.getElementById('jet-total-payments-input');
    if (totalPaymentsInput && totalPaymentsInput instanceof HTMLInputElement) {
      totalPaymentsInput.value = totalPaymentsEuro.toFixed(2);
    }

    var gprGlp = calculateGprGlp(vnoski, monthlyVnoskaEuro, totalCreditPriceEuro);
    var gprInput = document.getElementById('jet-fix-gpr-input');
    if (gprInput && gprInput instanceof HTMLInputElement) {
      gprInput.value = gprGlp.gpr.toFixed(2);
    }
    var glpInput = document.getElementById('jet-glp-input');
    if (glpInput && glpInput instanceof HTMLInputElement) {
      glpInput.value = gprGlp.glp.toFixed(2);
    }

    applyVnoskiOptionsRestrictions(totalCreditPriceEuro);
  }

  /**
   * Преизчислява стойностите в popup-а
   */
  function recalculatePopup() {
    const container = document.getElementById('jet-product-button-container');
    if (!container) return;

    const parvaInput = document.getElementById('jet-parva-input');
    const vnoskiSelect = document.getElementById('jet-vnoski-select');

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
    const vnoskiSelect = document.getElementById('jet-vnoski-select');
    if (vnoskiSelect && vnoskiSelect instanceof HTMLSelectElement) {
      for (let i = 0; i < vnoskiSelect.options.length; i++) {
        const opt = vnoskiSelect.options[i];
        if (opt) opt.disabled = disabledSet.has(opt.value);
      }
    }
    const vnoskiList = document.getElementById('jet-vnoski-list');
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
    const sel = document.getElementById('jet-vnoski-select');
    const display = document.getElementById('jet-vnoski-display');
    if (!sel || !display || !(sel instanceof HTMLSelectElement)) return;
    const opt = sel.options[sel.selectedIndex];
    display.textContent = opt ? opt.textContent || opt.value : '';
  }

  /** Синхронизира custom dropdown за вноски – картов попъп */
  function syncJetVnoskiDisplayCard() {
    const sel = document.getElementById('jet-vnoski-select-card');
    const display = document.getElementById('jet-vnoski-display-card');
    if (!sel || !display || !(sel instanceof HTMLSelectElement)) return;
    const opt = sel.options[sel.selectedIndex];
    display.textContent = opt ? opt.textContent || opt.value : '';
  }

  /** Прилага ограничения за опции вноски – картов попъп @param {number} totalCreditPriceEuro */
  function applyVnoskiOptionsRestrictionsCard(totalCreditPriceEuro) {
    const disabledSet = getDisabledVnoskiValues(totalCreditPriceEuro);
    const vnoskiSelect = document.getElementById('jet-vnoski-select-card');
    if (vnoskiSelect && vnoskiSelect instanceof HTMLSelectElement) {
      for (let i = 0; i < vnoskiSelect.options.length; i++) {
        const opt = vnoskiSelect.options[i];
        if (opt) opt.disabled = disabledSet.has(opt.value);
      }
    }
    const vnoskiList = document.getElementById('jet-vnoski-list-card');
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

  /** Обновява стойностите в картовия popup – използва jet_purcent_card @param {number} productPrice @param {number} parva @param {number} vnoski @param {number} jetPurcentCard */
  function updatePopupValuesCard(productPrice, parva, vnoski, jetPurcentCard) {
    const container = document.getElementById('jet-product-button-card-container');
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
    const parvaInput = document.getElementById('jet-parva-input-card');
    if (parvaInput && parvaInput instanceof HTMLInputElement) parvaInput.value = String(Math.round(parvaEuro));
    const productPriceInput = document.getElementById('jet-product-price-input-card');
    if (productPriceInput && productPriceInput instanceof HTMLInputElement) productPriceInput.value = (productPrice / 100).toFixed(2);
    const vnoskiSelect = document.getElementById('jet-vnoski-select-card');
    if (vnoskiSelect && vnoskiSelect instanceof HTMLSelectElement) {
      const val = String(vnoski);
      vnoskiSelect.value = val;
      for (let i = 0; i < vnoskiSelect.options.length; i++) {
        const opt = vnoskiSelect.options[i];
        if (opt && opt.value === val) { vnoskiSelect.selectedIndex = i; break; }
      }
      syncJetVnoskiDisplayCard();
    }
    const totalCreditInput = document.getElementById('jet-total-credit-input-card');
    if (totalCreditInput && totalCreditInput instanceof HTMLInputElement) totalCreditInput.value = totalCreditPriceEuro.toFixed(2);
    const monthlyVnoskaInput = document.getElementById('jet-monthly-vnoska-input-card');
    if (monthlyVnoskaInput && monthlyVnoskaInput instanceof HTMLInputElement) monthlyVnoskaInput.value = monthlyVnoskaEuro.toFixed(2);
    const totalPaymentsInput = document.getElementById('jet-total-payments-input-card');
    if (totalPaymentsInput && totalPaymentsInput instanceof HTMLInputElement) totalPaymentsInput.value = totalPaymentsEuro.toFixed(2);
    var gprGlp = calculateGprGlp(vnoski, monthlyVnoskaEuro, totalCreditPriceEuro);
    var gprInput = document.getElementById('jet-fix-gpr-input-card');
    if (gprInput && gprInput instanceof HTMLInputElement) gprInput.value = gprGlp.gpr.toFixed(2);
    var glpInput = document.getElementById('jet-glp-input-card');
    if (glpInput && glpInput instanceof HTMLInputElement) glpInput.value = gprGlp.glp.toFixed(2);
    applyVnoskiOptionsRestrictionsCard(totalCreditPriceEuro);
  }

  function recalculatePopupCard() {
    const container = document.getElementById('jet-product-button-card-container');
    if (!container) return;
    const parvaInput = document.getElementById('jet-parva-input-card');
    const vnoskiSelect = document.getElementById('jet-vnoski-select-card');
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
    const overlay = document.getElementById('jet-popup-overlay-card');
    if (!overlay) return;
    const container = document.getElementById('jet-product-button-card-container');
    if (!container) return;
    let productPrice = getVariantPrice();
    if (!productPrice || productPrice === 0) productPrice = parseFloat(container.dataset.productPrice || '0');
    const quantityInput = document.querySelector('input[name="quantity"], input[type="number"][name*="quantity"]');
    let quantity = 1;
    if (quantityInput && quantityInput instanceof HTMLInputElement) quantity = parseInt(quantityInput.value) || 1;
    productPrice = productPrice * quantity;
    const jetPurcentCard = parseFloat(container.dataset.jetPurcentCard || '0');
    const currentParva = parseFloat(container.dataset.jetParva || '0') || 0;
    const vnoskaEl = document.querySelector('.jet-vnoska-card');
    const vnoskiFromEl = vnoskaEl instanceof HTMLElement ? vnoskaEl.dataset.vnoski : undefined;
    const currentVnoski = parseInt(vnoskiFromEl || container.dataset.jetVnoskiDefault || '12', 10);
    const step1 = document.getElementById('jet-popup-step1-card');
    const step2 = document.getElementById('jet-popup-step2-card');
    const footerStep1 = document.getElementById('jet-popup-footer-step1-card');
    const footerStep2 = document.getElementById('jet-popup-footer-step2-card');
    if (step1) step1.style.display = '';
    if (step2) step2.style.display = 'none';
    if (footerStep1) footerStep1.style.display = '';
    if (footerStep2) footerStep2.style.display = 'none';
    const vnoskiListEl = document.getElementById('jet-vnoski-list-card');
    if (vnoskiListEl) vnoskiListEl.hidden = true;
    overlay.style.display = 'flex';
    updatePopupValuesCard(productPrice, currentParva, currentVnoski, jetPurcentCard);
  }

  function closeJetPopupCard() {
    const overlay = document.getElementById('jet-popup-overlay-card');
    if (overlay) overlay.style.display = 'none';
    var step2Ids = ['jet-step2-firstname-card', 'jet-step2-lastname-card', 'jet-step2-egn-card', 'jet-step2-phone-card', 'jet-step2-email-card'];
    step2Ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el instanceof HTMLInputElement) {
        el.value = '';
        el.classList.remove('jet-input-error');
      }
    });
    var termsCheck = document.getElementById('jet-step2-terms-checkbox-card');
    if (termsCheck && termsCheck instanceof HTMLInputElement) termsCheck.checked = false;
    var step2SubmitBtn = document.getElementById('jet-step2-submit-btn-card');
    if (step2SubmitBtn && step2SubmitBtn instanceof HTMLButtonElement) step2SubmitBtn.disabled = true;
    const step1 = document.getElementById('jet-popup-step1-card');
    const step2 = document.getElementById('jet-popup-step2-card');
    const footerStep1 = document.getElementById('jet-popup-footer-step1-card');
    const footerStep2 = document.getElementById('jet-popup-footer-step2-card');
    if (step1) step1.style.display = '';
    if (step2) step2.style.display = 'none';
    if (footerStep1) footerStep1.style.display = '';
    if (footerStep2) footerStep2.style.display = 'none';
    var termsCheckboxCard = document.getElementById('jet-terms-checkbox-card');
    var gdprCheckboxCard = document.getElementById('jet-gdpr-checkbox-card');
    if (termsCheckboxCard && termsCheckboxCard instanceof HTMLInputElement) {
      termsCheckboxCard.checked = false;
      termsCheckboxCard.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (gdprCheckboxCard && gdprCheckboxCard instanceof HTMLInputElement) {
      gdprCheckboxCard.checked = false;
      gdprCheckboxCard.dispatchEvent(new Event('change', { bubbles: true }));
    }
    var parvaInputCard = document.getElementById('jet-parva-input-card');
    if (parvaInputCard && parvaInputCard instanceof HTMLInputElement) {
      parvaInputCard.value = '0';
    }
    var addToCartCardBtn = document.getElementById('jet-add-to-cart-btn-card');
    if (addToCartCardBtn && addToCartCardBtn instanceof HTMLButtonElement) {
      addToCartCardBtn.disabled = false;
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
   * Изпраща POST заявка към приложението (app) с всички полета и items.
   * @param {boolean} [isCard=false] true ако изпращаме от попъпа за кредитна карта
   */
  function sendJetRequestToApp(isCard) {
    var container = document.getElementById('jet-product-button-container');
    if (!container) return;
    var jetId = (container.dataset.jetId || '').trim();
    var shopDomain = (container.dataset.shopDomain || '').trim();
    var shopPermanentDomain = (container.dataset.shopPermanentDomain || '').trim();
    var productId = (container.dataset.productId ?? '').toString().trim();
    var productTitle = (container.dataset.productTitle || '').trim();
    var productPriceCents = parseFloat(container.dataset.productPrice || '0') || 0;
    var productPriceEur = productPriceCents > 0
      ? (productPriceCents / 100).toFixed(2)
      : (container.dataset.productPriceEur ?? '').toString().trim();
    var variantOptions = (container.dataset.variantOptions || '').trim();
    var jetEmailPbpf = (container.dataset.jetEmailPbpf || '').trim();
    var jetEmailShop = (container.dataset.jetEmailShop || '').trim();
    var jetParva = (container.dataset.jetParva ?? '0').toString().trim();
    var primaryUrl = (container.dataset.jetPrimaryUrl || '').trim();
    var secondaryUrl = (container.dataset.jetSecondaryUrl || '').trim();

    var firstnameId = isCard ? 'jet-step2-firstname-card' : 'jet-step2-firstname';
    var lastnameId = isCard ? 'jet-step2-lastname-card' : 'jet-step2-lastname';
    var egnId = isCard ? 'jet-step2-egn-card' : 'jet-step2-egn';
    var phoneId = isCard ? 'jet-step2-phone-card' : 'jet-step2-phone';
    var emailId = isCard ? 'jet-step2-email-card' : 'jet-step2-email';
    var vnoskiSelectId = isCard ? 'jet-vnoski-select-card' : 'jet-vnoski-select';
    var vnoskaInputId = isCard ? 'jet-monthly-vnoska-input-card' : 'jet-monthly-vnoska-input';
    var parvaInputId = isCard ? 'jet-parva-input-card' : 'jet-parva-input';

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
    var vnoskaInputEl = document.getElementById(vnoskaInputId);
    var jetVnoska = (vnoskaInputEl instanceof HTMLInputElement && vnoskaInputEl.value) ? vnoskaInputEl.value.trim() : '';
    var parvaInputEl = document.getElementById(parvaInputId);
    var jetParvaFromInput = (parvaInputEl instanceof HTMLInputElement && parvaInputEl.value) ? parvaInputEl.value.trim() : jetParva;

    var items = [{
      jet_product_id: productId,
      product_c_txt: productTitle,
      att_name: variantOptions || undefined,
      product_p_txt: productPriceEur,
      jet_quantity: '1'
    }];

    if (!primaryUrl) {
      console.log('[Jet] Debug: jet_id=', jetId, '(primary URL не е зададен в снипета)');
      return;
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

    doFetch(primaryUrl)
      .then(function (data) {
        console.log('[Jet] App response (primary):', data);
      })
      .catch(function (err) {
        console.warn('[Jet] Primary failed:', err);
        if (secondaryUrl && secondaryUrl !== primaryUrl) {
          doFetch(secondaryUrl)
            .then(function (data) {
              console.log('[Jet] App response (fallback):', data);
            })
            .catch(function (err2) {
              console.warn('[Jet] Fallback failed:', err2);
            });
        }
      });
  }

  /**
   * Инициализира popup функционалността
   */
  function initPopup() {
    const overlay = document.getElementById('jet-popup-overlay');
    if (!overlay) return;

    // Попъпът се затваря само чрез бутоните (Откажи и др.), не при клик извън него

    // Custom dropdown за брой вноски
    const vnoskiSelect = document.getElementById('jet-vnoski-select');
    const vnoskiDisplay = document.getElementById('jet-vnoski-display');
    const vnoskiList = document.getElementById('jet-vnoski-list');
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

    // Бутон "Преизчисли"
    const recalculateBtn = document.getElementById('jet-recalculate-btn');
    if (recalculateBtn) {
      recalculateBtn.addEventListener('click', recalculatePopup);
    }

    // При излизане от полето за първоначална вноска – ограничаваме до макс и преизчисляваме
    const parvaInputForBlur = document.getElementById('jet-parva-input');
    if (parvaInputForBlur) {
      parvaInputForBlur.addEventListener('blur', recalculatePopup);
    }

    // Промяна на броя вноски (преизчисляване при избор от custom dropdown или при програмен промяна)
    const vnoskiSelectEl = document.getElementById('jet-vnoski-select');
    if (vnoskiSelectEl) {
      vnoskiSelectEl.addEventListener('change', recalculatePopup);
    }

    // Бутон "Откажи"
    const cancelBtn = document.getElementById('jet-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeJetPopup);
    }

    // Бутон "Добави в количката" – добавя продукта в количката и пренасочва към количката (без проверка на чекбоксите)
    const addToCartBtn = document.getElementById('jet-add-to-cart-btn');
    if (addToCartBtn) {
      addToCartBtn.addEventListener('click', function () {
        var btn = /** @type {HTMLButtonElement} */ (addToCartBtn);
        if (btn.disabled) return;
        btn.disabled = true;
        addCurrentProductToCartAndGoToCart().then(function (ok) {
          if (!ok) {
            btn.disabled = false;
            alert('Неуспешно добавяне в количката. Моля, опитайте отново или изберете вариант.');
          }
        });
      });
    }

    // Бутон "Купи на изплащане" – активира се само при двата чекбокса; при клик показва стъпка 2
    const buyOnCreditBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('jet-buy-on-credit-btn'));
    const termsCheckbox = document.getElementById('jet-terms-checkbox');
    const gdprCheckbox = document.getElementById('jet-gdpr-checkbox');

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
        const step1 = document.getElementById('jet-popup-step1');
        const step2 = document.getElementById('jet-popup-step2');
        const footerStep1 = document.getElementById('jet-popup-footer-step1');
        const footerStep2 = document.getElementById('jet-popup-footer-step2');
        if (step1) step1.style.display = 'none';
        if (step2) step2.style.display = 'flex';
        if (footerStep1) footerStep1.style.display = 'none';
        if (footerStep2) footerStep2.style.display = 'flex';
        setTimeout(updateStep2SubmitButtonState, 0);
      });
    }

    // Стъпка 2: Назад -> връщане към стъпка 1
    const step2BackBtn = document.getElementById('jet-step2-back-btn');
    if (step2BackBtn) {
      step2BackBtn.addEventListener('click', function () {
        const step1 = document.getElementById('jet-popup-step1');
        const step2 = document.getElementById('jet-popup-step2');
        const footerStep1 = document.getElementById('jet-popup-footer-step1');
        const footerStep2 = document.getElementById('jet-popup-footer-step2');
        if (step1) step1.style.display = '';
        if (step2) step2.style.display = 'none';
        if (footerStep1) footerStep1.style.display = '';
        if (footerStep2) footerStep2.style.display = 'none';
      });
    }

    // Стъпка 2: Откажи -> затваря попъпа
    const step2CancelBtn = document.getElementById('jet-step2-cancel-btn');
    if (step2CancelBtn) {
      step2CancelBtn.addEventListener('click', closeJetPopup);
    }

    // Стъпка 2: валидация и бутон Изпрати
    /**
     * Проверка дали всички условия за стъпка 2 са изпълнени.
     * Условия: попълнени Име и Фамилия, валидно ЕГН, телефон минимум 10 цифри,
     * валиден email, отметнат чекбокс за условията на ПБ Лични финанси.
     * При true активираме бутона Изпрати.
     * @returns {boolean}
     */
    function isStep2FormValid() {
      var firstname = document.getElementById('jet-step2-firstname');
      var lastname = document.getElementById('jet-step2-lastname');
      var egnInput = document.getElementById('jet-step2-egn');
      var phone = document.getElementById('jet-step2-phone');
      var email = document.getElementById('jet-step2-email');
      var terms = document.getElementById('jet-step2-terms-checkbox');
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

    /** Активира бутона Изпрати само ако всички условия са изпълнени. */
    function updateStep2SubmitButtonState() {
      var btn = document.getElementById('jet-step2-submit-btn');
      if (btn && btn instanceof HTMLButtonElement) {
        btn.disabled = !isStep2FormValid();
      }
    }

    /** Маркира невалидните полета в стъпка 2 с червена рамка */
    function highlightInvalidStep2Fields() {
      var firstname = document.getElementById('jet-step2-firstname');
      var lastname = document.getElementById('jet-step2-lastname');
      var egnInput = document.getElementById('jet-step2-egn');
      var phone = document.getElementById('jet-step2-phone');
      var email = document.getElementById('jet-step2-email');
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
    var step2InputIds = ['jet-step2-firstname', 'jet-step2-lastname', 'jet-step2-egn', 'jet-step2-phone', 'jet-step2-email'];
    step2InputIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('blur', updateStep2SubmitButtonState);
        el.addEventListener('focus', function () { clearInputError(el); });
      }
    });
    var egnEl = document.getElementById('jet-step2-egn');
    if (egnEl && egnEl instanceof HTMLInputElement) {
      var egnInputRef = egnEl;
      egnEl.addEventListener('input', function () {
        egnInputRef.value = egnInputRef.value.replace(/\D/g, '').slice(0, 10);
      });
    }
    var step2Terms = document.getElementById('jet-step2-terms-checkbox');
    if (step2Terms) {
      step2Terms.addEventListener('change', updateStep2SubmitButtonState);
    }

    const step2SubmitBtn = document.getElementById('jet-step2-submit-btn');
    const step2SubmitWrap = document.getElementById('jet-step2-submit-wrap');
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
        sendJetRequestToApp(false);
      });
    }
  }

  /**
   * Инициализира popup за бутона с кредитна карта (само ако jet_card_in е включен)
   */
  function initPopupCard() {
    const overlay = document.getElementById('jet-popup-overlay-card');
    const container = document.getElementById('jet-product-button-card-container');
    if (!overlay || !container) return;

    container.addEventListener('click', function () {
      openJetPopupCard();
    });

    var vnoskiSelect = document.getElementById('jet-vnoski-select-card');
    var vnoskiDisplay = document.getElementById('jet-vnoski-display-card');
    var vnoskiList = document.getElementById('jet-vnoski-list-card');
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

    var recalcCardBtn = document.getElementById('jet-recalculate-btn-card');
    if (recalcCardBtn) recalcCardBtn.addEventListener('click', recalculatePopupCard);
    var parvaCardInput = document.getElementById('jet-parva-input-card');
    if (parvaCardInput) parvaCardInput.addEventListener('blur', recalculatePopupCard);
    var vnoskiSelectCardEl = document.getElementById('jet-vnoski-select-card');
    if (vnoskiSelectCardEl) vnoskiSelectCardEl.addEventListener('change', recalculatePopupCard);

    var cancelCardBtn = document.getElementById('jet-cancel-btn-card');
    if (cancelCardBtn) cancelCardBtn.addEventListener('click', closeJetPopupCard);

    var addToCartCardBtn = document.getElementById('jet-add-to-cart-btn-card');
    if (addToCartCardBtn && addToCartCardBtn instanceof HTMLButtonElement) {
      var addToCartBtnRefCard = addToCartCardBtn;
      addToCartCardBtn.addEventListener('click', function () {
        if (addToCartBtnRefCard.disabled) return;
        addToCartBtnRefCard.disabled = true;
        addCurrentProductToCartAndGoToCart().then(function (ok) {
          if (!ok) addToCartBtnRefCard.disabled = false;
          else closeJetPopupCard();
        });
      });
    }

    var buyOnCreditCardBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('jet-buy-on-credit-btn-card'));
    var termsCard = document.getElementById('jet-terms-checkbox-card');
    var gdprCard = document.getElementById('jet-gdpr-checkbox-card');
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
        var s1 = document.getElementById('jet-popup-step1-card');
        var s2 = document.getElementById('jet-popup-step2-card');
        var f1 = document.getElementById('jet-popup-footer-step1-card');
        var f2 = document.getElementById('jet-popup-footer-step2-card');
        if (s1) s1.style.display = 'none';
        if (s2) s2.style.display = 'flex';
        if (f1) f1.style.display = 'none';
        if (f2) f2.style.display = 'flex';
        setTimeout(updateStep2SubmitButtonStateCard, 0);
      });
    }

    var step2BackCard = document.getElementById('jet-step2-back-btn-card');
    if (step2BackCard) {
      step2BackCard.addEventListener('click', function () {
        var s1 = document.getElementById('jet-popup-step1-card');
        var s2 = document.getElementById('jet-popup-step2-card');
        var f1 = document.getElementById('jet-popup-footer-step1-card');
        var f2 = document.getElementById('jet-popup-footer-step2-card');
        if (s1) s1.style.display = '';
        if (s2) s2.style.display = 'none';
        if (f1) f1.style.display = '';
        if (f2) f2.style.display = 'none';
      });
    }
    var step2CancelCard = document.getElementById('jet-step2-cancel-btn-card');
    if (step2CancelCard) step2CancelCard.addEventListener('click', closeJetPopupCard);

    function isStep2FormValidCard() {
      var fn = document.getElementById('jet-step2-firstname-card');
      var ln = document.getElementById('jet-step2-lastname-card');
      var egn = document.getElementById('jet-step2-egn-card');
      var ph = document.getElementById('jet-step2-phone-card');
      var em = document.getElementById('jet-step2-email-card');
      var tr = document.getElementById('jet-step2-terms-checkbox-card');
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
      var btn = document.getElementById('jet-step2-submit-btn-card');
      if (btn && btn instanceof HTMLButtonElement) btn.disabled = !isStep2FormValidCard();
    }
    function highlightInvalidStep2FieldsCard() {
      var fn = document.getElementById('jet-step2-firstname-card');
      var ln = document.getElementById('jet-step2-lastname-card');
      var egn = document.getElementById('jet-step2-egn-card');
      var ph = document.getElementById('jet-step2-phone-card');
      var em = document.getElementById('jet-step2-email-card');
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
    var step2InputIdsCard = ['jet-step2-firstname-card', 'jet-step2-lastname-card', 'jet-step2-egn-card', 'jet-step2-phone-card', 'jet-step2-email-card'];
    step2InputIdsCard.forEach(function (id) {
      var el = document.getElementById(id);
      if (el instanceof HTMLElement) {
        var fieldEl = el;
        el.addEventListener('blur', updateStep2SubmitButtonStateCard);
        el.addEventListener('focus', function () { clearInputErrorCard(fieldEl); });
      }
    });
    var egnCardEl = document.getElementById('jet-step2-egn-card');
    if (egnCardEl && egnCardEl instanceof HTMLInputElement) {
      var egnInputRefCard = egnCardEl;
      egnCardEl.addEventListener('input', function () {
        egnInputRefCard.value = egnInputRefCard.value.replace(/\D/g, '').slice(0, 10);
      });
    }
    var step2TermsCard = document.getElementById('jet-step2-terms-checkbox-card');
    if (step2TermsCard) step2TermsCard.addEventListener('change', updateStep2SubmitButtonStateCard);

    var step2SubmitWrapCard = document.getElementById('jet-step2-submit-wrap-card');
    var step2SubmitBtnCard = document.getElementById('jet-step2-submit-btn-card');
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
        sendJetRequestToApp(true);
      });
    }
  }

  function init() {
    const container = document.getElementById('jet-product-button-container');
    if (!container) return;

    // Инициализираме jet_parva от data атрибута (ако има такъв)
    jet_parva = parseFloat(container.dataset.jetParva || '0') || 0;

    // Инициализираме изчислението с текущата цена
    const productPrice = parseFloat(container.dataset.productPrice || '0');
    if (productPrice) {
      updateVnoskaText(productPrice, jet_parva);
    }

    container.addEventListener('click', function () {
      openJetPopup();
    });

    // Инициализираме popup функционалността
    initPopup();
    if (document.getElementById('jet-popup-overlay-card') && document.getElementById('jet-product-button-card-container')) {
      initPopupCard();
    }

    // Прихващаме промяна на опциите (варианти)
    // Използваме делегиране на събития за да работи и с динамично добавени елементи
    document.addEventListener('change', function (event) {
      const target = event.target;

      // Проверяваме дали е промяна на вариант (radio бутони за опции)
      if (target instanceof HTMLInputElement && target.type === 'radio') {
        const name = target.name || '';
        // Проверяваме дали е опция (Color, Size, или съдържа variant)
        if (name.includes('Color') || name.includes('Size') || name.includes('variant') || name.includes('option')) {
          updatePriceFromVariant();
          // Ако popup-ът е отворен, обновяваме го
          const overlay = document.getElementById('jet-popup-overlay');
          if (overlay && overlay.style.display === 'flex') {
            setTimeout(function () {
              openJetPopup();
            }, 300);
          }
        }
      }

      // Проверяваме дали е промяна на количеството
      if (target instanceof HTMLInputElement && (target.name === 'quantity' || target.name.includes('quantity'))) {
        const overlay = document.getElementById('jet-popup-overlay');
        if (overlay && overlay.style.display === 'flex') {
          setTimeout(function () {
            openJetPopup();
          }, 100);
        }
      }
    }, true); // Използваме capture phase за по-надеждно прихващане

    // Прихващаме и click събития за radio бутони (за по-бърза реакция)
    document.addEventListener('click', function (event) {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.type === 'radio') {
        const name = target.name || '';
        if (name.includes('Color') || name.includes('Size') || name.includes('variant') || name.includes('option')) {
          // Изчакваме малко за да се обнови checked състоянието
          setTimeout(function () {
            updatePriceFromVariant();
            // Ако popup-ът е отворен, обновяваме го
            const overlay = document.getElementById('jet-popup-overlay');
            if (overlay && overlay.style.display === 'flex') {
              setTimeout(function () {
                openJetPopup();
              }, 200);
            }
          }, 100);
        }
      }
    }, true);

    // Експортираме функциите глобално за използване при динамична промяна на цената или първоначалната вноска
    const jetProduct = {};
    jetProduct.calculateVnoski = calculateVnoski;
    jetProduct.calculateJetVnoska = calculateJetVnoska;
    jetProduct.formatEuro = formatEuro;
    jetProduct.updateVnoskaText = updateVnoskaText;
    jetProduct.setJetParva = setJetParva;
    jetProduct.getJetParva = function () {
      return jet_parva;
    };
    jetProduct.updatePriceFromVariant = updatePriceFromVariant;
    // @ts-ignore
    window.jetProduct = jetProduct;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
