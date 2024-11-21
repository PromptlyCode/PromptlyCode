function a() {
    b();
    c();
}

function b() {
    c();
}

function d(){
}

function c() {
    //d();
}
