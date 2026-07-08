import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export function ToastProvider({ children }) {
  return (
    <>
      {children}
      <ToastContainer
        position="top-right"
        autoClose={3500}
        hideProgressBar
        newestOnTop
        toastClassName="!font-body !text-sm !rounded-sm"
      />
    </>
  );
}