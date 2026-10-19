// Mock login + e-commerce checkout flow.
// Builds on pushEvent() from script.js and pushes GA4-style ecommerce events:
// view_item_list -> add_to_cart / remove_from_cart -> view_cart -> begin_checkout
// -> add_shipping_info -> add_payment_info -> purchase, plus login / logout.
// Cart and user live in localStorage so state survives page navigation.
(function () {
  var CURRENCY = "JPY";
  var CART_KEY = "gtmproto_cart";
  var USER_KEY = "gtmproto_user";

  var PRODUCTS = [
    { item_id: "SKU_001", item_name: "GTM Tee", item_category: "Apparel", price: 3500 },
    { item_id: "SKU_002", item_name: "dataLayer Mug", item_category: "Homeware", price: 1800 },
    { item_id: "SKU_003", item_name: "Tag Assistant Hoodie", item_category: "Apparel", price: 7200 },
    { item_id: "SKU_004", item_name: "Trigger Sticker Pack", item_category: "Accessories", price: 600 }
  ];

  var SHIPPING_COST = { standard: 0, express: 800 };

  // --- storage -------------------------------------------------------------

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function clear(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  function getUser() { return load(USER_KEY, null); }
  function getCart() { return load(CART_KEY, []); }

  // --- ecommerce helpers ---------------------------------------------------

  function findProduct(id) {
    for (var i = 0; i < PRODUCTS.length; i++) {
      if (PRODUCTS[i].item_id === id) return PRODUCTS[i];
    }
    return null;
  }

  function toItem(product, quantity, index) {
    var item = {
      item_id: product.item_id,
      item_name: product.item_name,
      item_brand: "GTM Prototype",
      item_category: product.item_category,
      price: product.price,
      quantity: quantity || 1
    };
    if (index != null) item.index = index;
    return item;
  }

  function cartItems() {
    return getCart().map(function (line) {
      var product = findProduct(line.item_id);
      return product ? toItem(product, line.quantity) : null;
    }).filter(Boolean);
  }

  function itemsValue(items) {
    return items.reduce(function (sum, item) { return sum + item.price * item.quantity; }, 0);
  }

  // GA4 recommends clearing the previous ecommerce object before each push.
  function pushEcommerce(eventName, ecommerce) {
    window.dataLayer.push({ ecommerce: null });
    pushEvent(eventName, { ecommerce: Object.assign({ currency: CURRENCY }, ecommerce) });
  }

  // Push an event, then navigate once GTM has fired its tags (or after a timeout
  // if GTM is blocked / not loaded).
  function pushThenGo(eventName, params, url) {
    var done = false;
    function go() {
      if (done) return;
      done = true;
      window.location.href = url;
    }
    pushEvent(eventName, Object.assign({}, params, { eventCallback: go, eventTimeout: 2000 }));
    setTimeout(go, 2500);
  }

  function formatPrice(n) {
    return new Intl.NumberFormat("ja-JP", { style: "currency", currency: CURRENCY }).format(n);
  }

  // Only allow redirects to local pages (avoids an open redirect via ?next=).
  function safeNext(next) {
    return /^[a-z-]+\.html$/.test(next || "") ? next : "shop.html";
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // --- shared header -------------------------------------------------------

  function updateHeader() {
    var count = document.getElementById("cart-count");
    if (count) {
      count.textContent = getCart().reduce(function (n, line) { return n + line.quantity; }, 0);
    }
    var account = document.getElementById("account-link");
    var user = getUser();
    if (account) account.textContent = user ? "Account" : "Login";
  }

  // --- login page ----------------------------------------------------------

  function initLogin() {
    var form = document.getElementById("login-form");
    if (!form) return;
    var loginSection = document.getElementById("login-section");
    var accountSection = document.getElementById("account-section");
    var next = safeNext(new URLSearchParams(window.location.search).get("next"));

    function render() {
      var user = getUser();
      loginSection.hidden = !!user;
      accountSection.hidden = !user;
      if (user) {
        document.getElementById("account-email").textContent = user.email;
        document.getElementById("account-user-id").textContent = user.user_id;
      }
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      var email = form.email.value.trim().toLowerCase();
      // Deterministic fake user ID so the same email always maps to the same user.
      var hash = 0;
      for (var i = 0; i < email.length; i++) hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
      var user = { email: email, user_id: "U" + hash.toString(36).toUpperCase() };
      save(USER_KEY, user);
      pushThenGo("login", { method: "email", user_id: user.user_id }, next);
    });

    document.getElementById("logout-button").addEventListener("click", function () {
      var user = getUser();
      clear(USER_KEY);
      pushEvent("logout", { user_id: user ? user.user_id : undefined });
      render();
      updateHeader();
    });

    render();
  }

  // --- shop page -----------------------------------------------------------

  function initShop() {
    var list = document.getElementById("product-list");
    if (!list) return;

    PRODUCTS.forEach(function (product) {
      var card = el("div", "card product-card");
      card.appendChild(el("p", "product-category", product.item_category));
      card.appendChild(el("h3", null, product.item_name));
      card.appendChild(el("p", "product-price", formatPrice(product.price)));
      var button = el("button", "btn add-to-cart", "Add to cart");
      button.type = "button";
      button.dataset.itemId = product.item_id;
      card.appendChild(button);
      list.appendChild(card);
    });

    pushEcommerce("view_item_list", {
      item_list_id: "shop",
      item_list_name: "Shop",
      items: PRODUCTS.map(function (p, i) { return toItem(p, 1, i); })
    });

    list.addEventListener("click", function (e) {
      var button = e.target.closest(".add-to-cart");
      if (!button) return;
      var product = findProduct(button.dataset.itemId);
      if (!product) return;

      var cart = getCart();
      var line = cart.filter(function (l) { return l.item_id === product.item_id; })[0];
      if (line) line.quantity += 1;
      else cart.push({ item_id: product.item_id, quantity: 1 });
      save(CART_KEY, cart);

      pushEcommerce("add_to_cart", { value: product.price, items: [toItem(product, 1)] });
      updateHeader();

      button.textContent = "Added ✓";
      setTimeout(function () { button.textContent = "Add to cart"; }, 1000);
    });
  }

  // --- cart page -----------------------------------------------------------

  function initCart() {
    var body = document.getElementById("cart-items");
    if (!body) return;
    var table = document.getElementById("cart-table");
    var empty = document.getElementById("cart-empty");
    var total = document.getElementById("cart-total");
    var checkout = document.getElementById("checkout-button");

    function render() {
      var items = cartItems();
      body.textContent = "";
      items.forEach(function (item) {
        var row = el("tr");
        row.appendChild(el("td", null, item.item_name));
        row.appendChild(el("td", null, String(item.quantity)));
        row.appendChild(el("td", null, formatPrice(item.price * item.quantity)));
        var cell = el("td");
        var remove = el("button", "btn btn-secondary btn-small remove-from-cart", "Remove");
        remove.type = "button";
        remove.dataset.itemId = item.item_id;
        cell.appendChild(remove);
        row.appendChild(cell);
        body.appendChild(row);
      });
      table.hidden = items.length === 0;
      checkout.hidden = items.length === 0;
      empty.hidden = items.length > 0;
      total.textContent = formatPrice(itemsValue(items));
      return items;
    }

    body.addEventListener("click", function (e) {
      var button = e.target.closest(".remove-from-cart");
      if (!button) return;
      var removed = cartItems().filter(function (i) { return i.item_id === button.dataset.itemId; })[0];
      save(CART_KEY, getCart().filter(function (l) { return l.item_id !== button.dataset.itemId; }));
      if (removed) {
        pushEcommerce("remove_from_cart", { value: itemsValue([removed]), items: [removed] });
      }
      render();
      updateHeader();
    });

    var items = render();
    pushEcommerce("view_cart", { value: itemsValue(items), items: items });
  }

  // --- checkout page -------------------------------------------------------

  function initCheckout() {
    var shippingForm = document.getElementById("shipping-form");
    if (!shippingForm) return;

    // Checkout requires a (mock) login.
    if (!getUser()) {
      window.location.replace("login.html?next=checkout.html");
      return;
    }

    var paymentForm = document.getElementById("payment-form");
    var items = cartItems();
    if (items.length === 0) {
      document.getElementById("checkout-empty").hidden = false;
      return;
    }

    var subtotal = itemsValue(items);
    var shippingTier = "standard";
    document.getElementById("checkout-summary").textContent =
      items.length + " item type(s) · subtotal " + formatPrice(subtotal);
    shippingForm.hidden = false;

    pushEcommerce("begin_checkout", { value: subtotal, items: items });

    shippingForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!shippingForm.checkValidity()) {
        shippingForm.reportValidity();
        return;
      }
      shippingTier = shippingForm.shipping_tier.value;
      pushEcommerce("add_shipping_info", { value: subtotal, shipping_tier: shippingTier, items: items });
      shippingForm.hidden = true;
      paymentForm.hidden = false;
    });

    paymentForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!paymentForm.checkValidity()) {
        paymentForm.reportValidity();
        return;
      }
      var paymentType = paymentForm.payment_type.value;
      pushEcommerce("add_payment_info", { value: subtotal, payment_type: paymentType, items: items });

      var transactionId = "T-" + Date.now();
      pushEcommerce("purchase", {
        transaction_id: transactionId,
        value: subtotal,
        shipping: SHIPPING_COST[shippingTier] || 0,
        items: items
      });

      clear(CART_KEY);
      updateHeader();
      paymentForm.hidden = true;
      document.getElementById("order-id").textContent = transactionId;
      document.getElementById("order-confirmation").hidden = false;
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var user = getUser();
    // Expose the logged-in user to GTM as a dataLayer variable on every page.
    if (user) window.dataLayer.push({ user_id: user.user_id, login_status: "logged_in" });
    else window.dataLayer.push({ login_status: "logged_out" });

    updateHeader();
    initLogin();
    initShop();
    initCart();
    initCheckout();
  });
})();
