import { mount } from "svelte";
import App3D from "./App3D.svelte";
import "../app.css";

mount(App3D, { target: document.getElementById("app")! });
