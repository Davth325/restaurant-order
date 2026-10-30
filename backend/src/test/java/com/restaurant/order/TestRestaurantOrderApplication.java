package com.restaurant.order;

import org.springframework.boot.SpringApplication;

public class TestRestaurantOrderApplication {

	public static void main(String[] args) {
		SpringApplication.from(RestaurantOrderApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
