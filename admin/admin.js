document.addEventListener("DOMContentLoaded", initAdmin);

async function initAdmin() {
  const loadingScreen = document.getElementById("loadingScreen");
  const loginScreen = document.getElementById("loginScreen");
  const adminApp = document.getElementById("adminApp");
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");
  const loginBtn = document.getElementById("loginBtn");

  try {
    const {
      data: { session },
      error
    } = await jbicinSupabase.auth.getSession();

    if (error) throw error;

    loadingScreen.classList.add("hidden");

    if (!session) {
      loginScreen.classList.remove("hidden");

      loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        loginError.style.display = "none";
        loginError.textContent = "";
        loginBtn.disabled = true;
        loginBtn.textContent = "ENTRANDO...";

        const email =
          document.getElementById("loginEmail").value.trim();

        const password =
          document.getElementById("loginPassword").value;

        try {
          const { data, error } =
            await jbicinSupabase.auth.signInWithPassword({
              email,
              password
            });

          if (error) throw error;

          const user = data.user;

          const {
            data: adminUser,
            error: adminError
          } = await jbicinSupabase
            .from("admin_users")
            .select("user_id, role")
            .eq("user_id", user.id)
            .eq("role", "admin")
            .maybeSingle();

          if (adminError) throw adminError;

          if (!adminUser) {
            await jbicinSupabase.auth.signOut();
            throw new Error(
              "Este usuario no tiene permisos de administrador."
            );
          }

          window.location.reload();

        } catch (error) {
          console.error(error);

          loginError.textContent =
            error.message ||
            "No se pudo iniciar sesión.";

          loginError.style.display = "block";

          loginBtn.disabled = false;
          loginBtn.textContent = "ENTRAR";
        }
      });

      return;
    }

    const {
      data: adminUser,
      error: adminError
    } = await jbicinSupabase
      .from("admin_users")
      .select("user_id, role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (adminError) throw adminError;

    if (!adminUser) {
      await jbicinSupabase.auth.signOut();

      loginScreen.classList.remove("hidden");

      return;
    }

    document.getElementById("adminEmail").textContent =
      session.user.email || "";

    adminApp.classList.remove("hidden");

    setupNavigation();

    document.getElementById("dashboardDate").textContent =
      new Date().toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "long",
        year: "numeric"
      });

    await loadDashboard();
    await loadProducts();
    await loadStock();
    await loadCategories();

  } catch (error) {
    console.error(error);

    loadingScreen.classList.add("hidden");

    loginScreen.classList.remove("hidden");

    const loginError =
      document.getElementById("loginError");

    loginError.textContent =
      "No se pudo conectar con el sistema de acceso.";

    loginError.style.display = "block";
  }
}


/* ==========================================
   NAVEGACIÓN
========================================== */

function setupNavigation() {
  const buttons =
    document.querySelectorAll(".nav-btn");

  const sections =
    document.querySelectorAll(".admin-section");

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      const target = button.dataset.section;

      buttons.forEach(btn =>
        btn.classList.remove("active")
      );

      sections.forEach(section =>
        section.classList.remove("active")
      );

      button.classList.add("active");

      const targetSection =
        document.getElementById(target);

      if (targetSection) {
        targetSection.classList.add("active");
      }
    });
  });


  document
    .getElementById("logoutBtn")
    .addEventListener("click", async () => {

      await jbicinSupabase.auth.signOut();

      window.location.reload();

    });
}


/* ==========================================
   DASHBOARD
========================================== */

async function loadDashboard() {
  const { data: products, error: productsError } =
    await jbicinSupabase
      .from("products")
      .select("id, is_published");

  if (productsError) {
    console.error(productsError);
    return;
  }


  const { data: variants, error: variantsError } =
    await jbicinSupabase
      .from("product_variants")
      .select("id, stock");

  if (variantsError) {
    console.error(variantsError);
    return;
  }


  const totalStock =
    variants.reduce(
      (sum, variant) =>
        sum + Number(variant.stock || 0),
      0
    );


  const published =
    products.filter(
      product => product.is_published
    ).length;


  document.getElementById("statProducts").textContent =
    products.length;

  document.getElementById("statPublished").textContent =
    published;

  document.getElementById("statVariants").textContent =
    variants.length;

  document.getElementById("statStock").textContent =
    totalStock;


  const summary =
    document.getElementById("inventorySummary");

  summary.innerHTML = `
    <div class="success-box">
      El inventario contiene
      <strong>${totalStock}</strong>
      unidades actualmente.
    </div>
  `;
}


/* ==========================================
   PRODUCTOS
========================================== */

async function loadProducts() {
  const container =
    document.getElementById("productsTable");

  const { data, error } =
    await jbicinSupabase
      .from("products")
      .select(`
        id,
        name,
        slug,
        gender,
        price_eur,
        is_published,
        categories (
          name
        )
      `)
      .order("created_at", {
        ascending: false
      });


  if (error) {
    console.error(error);

    container.innerHTML =
      "<p>No se pudieron cargar los productos.</p>";

    return;
  }


  if (!data.length) {
    container.innerHTML =
      "<p>No hay productos todavía.</p>";

    return;
  }


  container.innerHTML = `
    <div class="table-wrapper">
      <table>

        <thead>
          <tr>
            <th>Producto</th>
            <th>Categoría</th>
            <th>Género</th>
            <th>Precio</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>

        <tbody>

          ${data.map(product => `

            <tr>

              <td>
                <strong>
                  ${escapeHtml(product.name)}
                </strong>
              </td>

              <td>
                ${escapeHtml(
                  product.categories?.name || "—"
                )}
              </td>

              <td>
                ${escapeHtml(product.gender || "—")}
              </td>

              <td>
                €${Number(product.price_eur).toFixed(2)}
              </td>

              <td>

                ${
                  product.is_published
                    ? `<span class="badge published">Publicado</span>`
                    : `<span class="badge">Borrador</span>`
                }

              </td>

              <td>

                <button
                  class="small-btn"
                  onclick="togglePublished(
                    '${product.id}',
                    ${product.is_published}
                  )"
                >
                  ${
                    product.is_published
                      ? "Ocultar"
                      : "Publicar"
                  }
                </button>

              </td>

            </tr>

          `).join("")}

        </tbody>

      </table>
    </div>
  `;
}


/* ==========================================
   PUBLICAR / OCULTAR
========================================== */

async function togglePublished(
  productId,
  currentState
) {
  const { error } =
    await jbicinSupabase
      .from("products")
      .update({
        is_published: !currentState
      })
      .eq("id", productId);


  if (error) {
    alert(
      "No se pudo actualizar el producto."
    );

    console.error(error);

    return;
  }


  await loadProducts();
  await loadDashboard();
}


/* ==========================================
   STOCK
========================================== */

async function loadStock() {
  const container =
    document.getElementById("stockTable");

  const { data, error } =
    await jbicinSupabase
      .from("product_variants")
      .select(`
        id,
        size,
        color,
        sku,
        stock,
        products (
          name
        )
      `)
      .order("stock", {
        ascending: true
      });


  if (error) {
    console.error(error);

    container.innerHTML =
      "<p>No se pudo cargar el stock.</p>";

    return;
  }


  if (!data.length) {
    container.innerHTML =
      "<p>No hay variantes de producto.</p>";

    return;
  }


  container.innerHTML = `
    <div class="table-wrapper">

      <table>

        <thead>

          <tr>
            <th>Producto</th>
            <th>Talla</th>
            <th>Color</th>
            <th>SKU</th>
            <th>Stock</th>
            <th>Acción</th>
          </tr>

        </thead>

        <tbody>

          ${data.map(variant => `

            <tr>

              <td>
                <strong>
                  ${escapeHtml(
                    variant.products?.name || "—"
                  )}
                </strong>
              </td>

              <td>
                ${escapeHtml(
                  variant.size || "—"
                )}
              </td>

              <td>
                ${escapeHtml(
                  variant.color || "—"
                )}
              </td>

              <td>
                ${escapeHtml(
                  variant.sku || "—"
                )}
              </td>

              <td>

                <span class="
                  stock-number
                  ${
                    variant.stock <= 2
                      ? "low-stock"
                      : ""
                  }
                ">
                  ${variant.stock}
                </span>

              </td>

              <td>

                <button
                  class="small-btn"
                  onclick="addStock('${variant.id}')"
                >
                  + Stock
                </button>

                <button
                  class="small-btn danger"
                  onclick="removeStock(
                    '${variant.id}',
                    ${variant.stock}
                  )"
                >
                  − Stock
                </button>

              </td>

            </tr>

          `).join("")}

        </tbody>

      </table>

    </div>
  `;
}


/* ==========================================
   AÑADIR STOCK
========================================== */

async function addStock(variantId) {
  const amount =
    Number(
      prompt("¿Cuántas unidades quieres añadir?")
    );

  if (!Number.isInteger(amount) || amount <= 0) {
    return;
  }

  const { error } =
    await jbicinSupabase.rpc(
      "adjust_stock",
      {
        p_variant_id: variantId,
        p_quantity_change: amount,
        p_reason: "entrada",
        p_note: "Entrada manual desde panel"
      }
    );

  if (error) {
    alert(
      "No se pudo actualizar el stock."
    );

    console.error(error);

    return;
  }

  await loadStock();
  await loadDashboard();
}


/* ==========================================
   QUITAR STOCK
========================================== */

async function removeStock(
  variantId,
  currentStock
) {
  const amount =
    Number(
      prompt(
        `Stock actual: ${currentStock}\n\n¿Cuántas unidades quieres retirar?`
      )
    );

  if (
    !Number.isInteger(amount) ||
    amount <= 0
  ) {
    return;
  }

  if (amount > currentStock) {
    alert(
      "No puedes retirar más unidades de las disponibles."
    );

    return;
  }

  const { error } =
    await jbicinSupabase.rpc(
      "adjust_stock",
      {
        p_variant_id: variantId,
        p_quantity_change: -amount,
        p_reason: "salida",
        p_note: "Salida manual desde panel"
      }
    );

  if (error) {
    alert(
      "No se pudo actualizar el stock."
    );

    console.error(error);

    return;
  }

  await loadStock();
  await loadDashboard();
}


/* ==========================================
   CATEGORÍAS
========================================== */

async function loadCategories() {
  const container =
    document.getElementById("categoriesTable");

  const { data, error } =
    await jbicinSupabase
      .from("categories")
      .select("id, name, slug")
      .order("name");


  if (error) {
    console.error(error);

    container.innerHTML =
      "<p>No se pudieron cargar las categorías.</p>";

    return;
  }


  if (!data.length) {
    container.innerHTML =
      "<p>No hay categorías.</p>";

    return;
  }


  container.innerHTML = `
    <div class="table-wrapper">

      <table>

        <thead>
          <tr>
            <th>Nombre</th>
            <th>Slug</th>
          </tr>
        </thead>

        <tbody>

          ${data.map(category => `

            <tr>

              <td>
                <strong>
                  ${escapeHtml(category.name)}
                </strong>
              </td>

              <td>
                ${escapeHtml(category.slug)}
              </td>

            </tr>

          `).join("")}

        </tbody>

      </table>

    </div>
  `;
}


/* ==========================================
   SEGURIDAD HTML
========================================== */

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
document.addEventListener("click", (event) => {

  if (event.target.id === "newProductBtn") {

    const panel = document.getElementById("productFormPanel");

    if (panel) {
      panel.classList.remove("hidden");

      panel.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

  }

  if (
    event.target.id === "cancelProductBtn" ||
    event.target.id === "cancelProductBtnBottom"
  ) {

    const panel = document.getElementById("productFormPanel");

    if (panel) {
      panel.classList.add("hidden");
    }

  }

});

  if (error) {
    alert("Error al crear el producto");
    console.error(error);
    return;
  }

  alert("Producto creado correctamente ✨");

  if (typeof loadProducts === "function") await loadProducts();
  if (typeof loadDashboard === "function") await loadDashboard();
}
