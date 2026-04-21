import React from "react";

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// 🧠 Importar el provider global del tema
import { ThemeProvider } from "./pages/Admin/ThemeContext";

import LoginForm from "./pages/LoginForm";
import Home from "./pages/Cajero/Home";
import Cobrar from "./pages/Cajero/Cobrar";
import Catalogo from "./pages/Cajero/Catalogo";
import CerrarCaja from "./pages/Cajero/CerrarCaja";
import HomeAdmin from "./pages/Admin/HomeAdmin";
import ConsultaFacturas from "./pages/Cajero/ConsultaFacturas";
import ConsultaProductos from "./pages/Cajero/ConsultaProductos";
import AbrirCaja from "./pages/Cajero/AbrirCaja";
import Clientes from "./pages/Cajero/Clientes";
import GestionClientes from "./pages/Admin/GestionClientes";
import ConsultaInventarioProductos from "./pages/Admin/ConsultaInventarioProductos";
import RegistroProductos from "./pages/Admin/RegistroProducto";
import GestionCategorias from "./pages/Admin/GestionCategorias";
import CrearUsuario from "./pages/Admin/CrearUsuario";
import BuscarUsuarios from "./pages/Admin/BuscarUsuarios";
import ConsultarVentas from "./pages/Admin/ConsultarVentas";
import CierresCaja from "./pages/Admin/CierresCaja";
import GestionProveedores from "./pages/Admin/GestionProveedores";
import Indicadores from "./pages/Admin/Indicadores";
import SedePrincipal from "./pages/Admin/SedePrincipal";
import ProductosRecogidos from "./pages/Admin/ProductosRecogidos";
import HomePrincipal from "./pages/HomePrincipal";
import Movimientos from "./pages/Admin/Movimientos";
import ListaPrecios from "./pages/Admin/ListaPrecios";
import CalibrarProductos from "./pages/Admin/CalibrarProductos";
import RegistroCompras from "./pages/Admin/RegistroCompras";
import RegistroVentas from "./pages/Admin/RegistroVentas";
import ConfiguracionSistema from "./pages/Admin/ConfiguracionSistema";
import Auditoria from "./pages/Admin/Auditoria";
import UsuariosPermiso from "./pages/Admin/UsuariosPermiso";
import PerfilAdmin from "./pages/Admin/PerfilAdmin";
import PerfilCajera from "./pages/Cajero/PerfilCajera";
import GestionPapelera from "./pages/Admin/GestionPapelera";
import ModeloFactura from "./pages/Admin/ModeloFactura";

function App() {
  return (
    // 🌗 Todo el sistema ahora envuelto por el ThemeProvider
    <ThemeProvider>
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Router>
          <Routes>
            {/* rutas cajero */}
            <Route path="/" element={<HomePrincipal />} />
            <Route path="/loginForm" element={<LoginForm />} />
            <Route path="/cobrar" element={<Cobrar />} />
            <Route path="/Catalogo" element={<Catalogo />} />
            <Route path="/CerrarCaja" element={<CerrarCaja />} />
            <Route path="/ConsultaFacturas" element={<ConsultaFacturas />} />
            <Route path="/ConsultaProductos" element={<ConsultaProductos />} />
            <Route path="/AbrirCaja" element={<AbrirCaja />} />
            <Route path="/Clientes" element={<Clientes />} />
            <Route path="/Home" element={<Home />} />
            <Route path="/PerfilCajera" element={<PerfilCajera />} />

            {/* Rutas de admin */}
            <Route path="/HomeAdmin" element={<HomeAdmin />}>
              <Route path="GestionClientes" element={<GestionClientes />} />
              <Route
                path="ConsultaInventarioProductos"
                element={<ConsultaInventarioProductos />}
              />
              <Route path="RegistroProductos" element={<RegistroProductos />} />
              <Route path="GestionCategorias" element={<GestionCategorias />} />
              <Route path="CrearUsuario" element={<CrearUsuario />} />
              <Route path="BuscarUsuarios" element={<BuscarUsuarios />} />
              <Route path="ConsultarVentas" element={<ConsultarVentas />} />
              <Route path="CierresCaja" element={<CierresCaja />} />
              <Route
                path="GestionProveedores"
                element={<GestionProveedores />}
              />
              <Route path="Indicadores" element={<Indicadores />} />
              <Route path="SedePrincipal" element={<SedePrincipal />} />
              <Route
                path="ProductosRecogidos"
                element={<ProductosRecogidos />}
              />
              <Route path="Movimientos" element={<Movimientos />} />
              <Route path="ListaPrecios" element={<ListaPrecios />} />
              <Route
                path="CalibrarProductos"
                element={<CalibrarProductos />}
              />
              <Route path="RegistroCompras" element={<RegistroCompras />} />
              <Route path="RegistroVentas" element={<RegistroVentas />} />
              <Route
                path="ConfiguracionSistema"
                element={<ConfiguracionSistema />}
              />
              <Route path="Auditoria" element={<Auditoria />} />
              <Route path="UsuariosPermiso" element={<UsuariosPermiso />} />
              <Route path="PerfilAdmin" element={<PerfilAdmin />} />
              <Route path="GestionPapelera" element={<GestionPapelera />} />
              <Route path="ModeloFactura" element={<ModeloFactura />} />
              
            </Route>
          </Routes>
        </Router>
      </div>
    </ThemeProvider>
  );
}

export default App;
